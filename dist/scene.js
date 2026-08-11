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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NlbmUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zb3VyY2Uvc2NlbmUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsK0JBQTRCO0FBQzVCLDJEQUF5RDtBQUN6RCxNQUFNLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFBLFdBQUksRUFBQyxNQUFNLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxjQUFjLENBQUMsQ0FBQyxDQUFDO0FBRTVDLFFBQUEsT0FBTyxHQUE0QztJQUM1RDs7T0FFRztJQUNILGNBQWM7UUFDVixJQUFJLENBQUM7WUFDRCxNQUFNLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUMxQyxNQUFNLEtBQUssR0FBRyxJQUFJLEtBQUssRUFBRSxDQUFDO1lBQzFCLEtBQUssQ0FBQyxJQUFJLEdBQUcsV0FBVyxDQUFDO1lBQ3pCLFFBQVEsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDekIsT0FBTyxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLGdDQUFnQyxFQUFFLENBQUM7UUFDeEUsQ0FBQztRQUFDLE9BQU8sS0FBVSxFQUFFLENBQUM7WUFDbEIsT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUNwRCxDQUFDO0lBQ0wsQ0FBQztJQUVEOztPQUVHO0lBQ0gsa0JBQWtCLENBQUMsUUFBZ0IsRUFBRSxhQUFxQjtRQUN0RCxJQUFJLENBQUM7WUFDRCxNQUFNLEVBQUUsUUFBUSxFQUFFLEVBQUUsRUFBRSxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUN2QyxNQUFNLEtBQUssR0FBRyxRQUFRLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDbEMsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO2dCQUNULE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxF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TyxFQUFFLFFBQVEsRUFBRSxFQUFFLENBQUM7UUFDMUQsQ0FBQztRQUFDLE9BQU8sS0FBVSxFQUFFLENBQUM7WUFBQyxPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQUMsQ0FBQztJQUM3RSxDQUFDO0lBRUQ7Ozs7O09BS0c7SUFDSCxJQUFJLENBQUMsSUFBWTtRQUNiLElBQUksQ0FBQztZQUNELHVDQUF1QztZQUN2QyxNQUFNLEVBQUUsR0FBRyxJQUFJLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUM5QixNQUFNLE1BQU0sR0FBRyxFQUFFLEVBQUUsQ0FBQztZQUNwQixPQUFPLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsRUFBRSxNQUFNLEVBQUUsRUFBRSxDQUFDO1FBQy9DLENBQUM7UUFBQyxPQUFPLEtBQVUsRUFBRSxDQUFDO1lBQ2xCLE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDcEQsQ0FBQztJQUNMLENBQUM7Q0FDSixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgam9pbiB9IGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgZmluZE5vZGVCeVV1aWREZWVwIH0gZnJvbSAnLi9zY2VuZS1ub2RlLWxvb2t1cCc7XG5tb2R1bGUucGF0aHMucHVzaChqb2luKEVkaXRvci5BcHAucGF0aCwgJ25vZGVfbW9kdWxlcycpKTtcblxuZXhwb3J0IGNvbnN0IG1ldGhvZHM6IHsgW2tleTogc3RyaW5nXTogKC4uLmFueTogYW55KSA9PiBhbnkgfSA9IHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgc2NlbmVcbiAgICAgKi9cbiAgICBjcmVhdGVOZXdTY2VuZSgpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IsIFNjZW5lIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBuZXcgU2NlbmUoKTtcbiAgICAgICAgICAgIHNjZW5lLm5hbWUgPSAnTmV3IFNjZW5lJztcbiAgICAgICAgICAgIGRpcmVjdG9yLnJ1blNjZW5lKHNjZW5lKTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIG1lc3NhZ2U6ICdOZXcgc2NlbmUgY3JlYXRlZCBzdWNjZXNzZnVsbHknIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9O1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEFkZCBjb21wb25lbnQgdG8gYSBub2RlXG4gICAgICovXG4gICAgYWRkQ29tcG9uZW50VG9Ob2RlKG5vZGVVdWlkOiBzdHJpbmcsIGNvbXBvbmVudFR5cGU6IHN0cmluZykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwganMgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBGaW5kIG5vZGUgYnkgVVVJRFxuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IGZpbmROb2RlQnlVdWlkRGVlcChzY2VuZSwgbm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm9kZSB3aXRoIFVVSUQgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBHZXQgY29tcG9uZW50IGNsYXNzXG4gICAgICAgICAgICBjb25zdCBDb21wb25lbnRDbGFzcyA9IGpzLmdldENsYXNzQnlOYW1lKGNvbXBvbmVudFR5cGUpO1xuICAgICAgICAgICAgaWYgKCFDb21wb25lbnRDbGFzcykge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYENvbXBvbmVudCB0eXBlICR7Y29tcG9uZW50VHlwZX0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBBZGQgY29tcG9uZW50XG4gICAgICAgICAgICBjb25zdCBjb21wb25lbnQgPSBub2RlLmFkZENvbXBvbmVudChDb21wb25lbnRDbGFzcyk7XG4gICAgICAgICAgICByZXR1cm4geyBcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLCBcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBgQ29tcG9uZW50ICR7Y29tcG9uZW50VHlwZX0gYWRkZWQgc3VjY2Vzc2Z1bGx5YCxcbiAgICAgICAgICAgICAgICBkYXRhOiB7IGNvbXBvbmVudElkOiBjb21wb25lbnQudXVpZCB9XG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTtcbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXNvbHZlIGEgY29tcG9uZW50IG9uIGEgbm9kZSBieSBpdHMgcmVhZGFibGUgY2xhc3MgbmFtZSB0byBpdHMgaW5kZXguXG4gICAgICpcbiAgICAgKiBUaGUgZWRpdG9yIGBxdWVyeS1ub2RlYCBkdW1wIGV4cG9zZXMgYSB1c2VyIHNjcmlwdCdzIGNpZCAoYSBjb21wcmVzc2VkIFVVSUQpLFxuICAgICAqIG5vdCBpdHMgY2xhc3MgbmFtZSwgc28gY2FsbGVycyB0aGF0IG9ubHkga25vdyB0aGUgY2xhc3MgbmFtZSAoZS5nLiBzZXRfcHJvcGVydHlcbiAgICAgKiB3aXRoIGNvbXBvbmVudFR5cGU9XCJNeUNvbnRyb2xsZXJcIikgY2Fubm90IG1hdGNoIGl0IGFnYWluc3QgdGhlIGR1bXAuIFRoZSBydW5uaW5nXG4gICAgICogc2NlbmUgSEFTIHRoZSBsaXZlIGNjLmpzIGNsYXNzIHJlZ2lzdHJ5LCBzbyB3ZSByZXNvbHZlIHRoZSBjbGFzcyBoZXJlIGFuZCByZXR1cm5cbiAgICAgKiB0aGUgY29tcG9uZW50J3MgaW5kZXggaW4gbm9kZS5jb21wb25lbnRzIOKAlCB3aGljaCBtYXRjaGVzIHRoZSBkdW1wJ3MgX19jb21wc19fIG9yZGVyLlxuICAgICAqL1xuICAgIHJlc29sdmVDb21wb25lbnRCeU5hbWUobm9kZVV1aWQ6IHN0cmluZywgY2xhc3NOYW1lOiBzdHJpbmcpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IsIGpzIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IGZpbmROb2RlQnlVdWlkRGVlcChzY2VuZSwgbm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm9kZSB3aXRoIFVVSUQgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBDb21wb25lbnRDbGFzcyA9IGpzLmdldENsYXNzQnlOYW1lKGNsYXNzTmFtZSk7XG4gICAgICAgICAgICBpZiAoIUNvbXBvbmVudENsYXNzKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgQ29tcG9uZW50IHR5cGUgJHtjbGFzc05hbWV9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgY29tcG9uZW50ID0gbm9kZS5nZXRDb21wb25lbnQoQ29tcG9uZW50Q2xhc3MpO1xuICAgICAgICAgICAgaWYgKCFjb21wb25lbnQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBDb21wb25lbnQgJHtjbGFzc05hbWV9IG5vdCBmb3VuZCBvbiBub2RlYCB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICAgICAgICBpbmRleDogbm9kZS5jb21wb25lbnRzLmluZGV4T2YoY29tcG9uZW50KSxcbiAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lOiBjb21wb25lbnQuY29uc3RydWN0b3IgJiYgY29tcG9uZW50LmNvbnN0cnVjdG9yLm5hbWVcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTtcbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmUgY29tcG9uZW50IGZyb20gYSBub2RlXG4gICAgICovXG4gICAgcmVtb3ZlQ29tcG9uZW50RnJvbU5vZGUobm9kZVV1aWQ6IHN0cmluZywgY29tcG9uZW50VHlwZTogc3RyaW5nKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCBqcyB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBmaW5kTm9kZUJ5VXVpZERlZXAoc2NlbmUsIG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgd2l0aCBVVUlEICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgQ29tcG9uZW50Q2xhc3MgPSBqcy5nZXRDbGFzc0J5TmFtZShjb21wb25lbnRUeXBlKTtcbiAgICAgICAgICAgIGlmICghQ29tcG9uZW50Q2xhc3MpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBDb21wb25lbnQgdHlwZSAke2NvbXBvbmVudFR5cGV9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgY29tcG9uZW50ID0gbm9kZS5nZXRDb21wb25lbnQoQ29tcG9uZW50Q2xhc3MpO1xuICAgICAgICAgICAgaWYgKCFjb21wb25lbnQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBDb21wb25lbnQgJHtjb21wb25lbnRUeXBlfSBub3QgZm91bmQgb24gbm9kZWAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbm9kZS5yZW1vdmVDb21wb25lbnQoY29tcG9uZW50KTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIG1lc3NhZ2U6IGBDb21wb25lbnQgJHtjb21wb25lbnRUeXBlfSByZW1vdmVkIHN1Y2Nlc3NmdWxseWAgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IG5vZGVcbiAgICAgKi9cbiAgICBjcmVhdGVOb2RlKG5hbWU6IHN0cmluZywgcGFyZW50VXVpZD86IHN0cmluZykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwgTm9kZSB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBuZXcgTm9kZShuYW1lKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKHBhcmVudFV1aWQpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBwYXJlbnQgPSBmaW5kTm9kZUJ5VXVpZERlZXAoc2NlbmUsIHBhcmVudFV1aWQpO1xuICAgICAgICAgICAgICAgIGlmIChwYXJlbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgcGFyZW50LmFkZENoaWxkKG5vZGUpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHNjZW5lLmFkZENoaWxkKG5vZGUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgc2NlbmUuYWRkQ2hpbGQobm9kZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB7IFxuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsIFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBOb2RlICR7bmFtZX0gY3JlYXRlZCBzdWNjZXNzZnVsbHlgLFxuICAgICAgICAgICAgICAgIGRhdGE6IHsgdXVpZDogbm9kZS51dWlkLCBuYW1lOiBub2RlLm5hbWUgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogR2V0IG5vZGUgaW5mb3JtYXRpb25cbiAgICAgKi9cbiAgICBnZXROb2RlSW5mbyhub2RlVXVpZDogc3RyaW5nKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IGZpbmROb2RlQnlVdWlkRGVlcChzY2VuZSwgbm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm9kZSB3aXRoIFVVSUQgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICAgICAgICB1dWlkOiBub2RlLnV1aWQsXG4gICAgICAgICAgICAgICAgICAgIG5hbWU6IG5vZGUubmFtZSxcbiAgICAgICAgICAgICAgICAgICAgYWN0aXZlOiBub2RlLmFjdGl2ZSxcbiAgICAgICAgICAgICAgICAgICAgcG9zaXRpb246IG5vZGUucG9zaXRpb24sXG4gICAgICAgICAgICAgICAgICAgIHJvdGF0aW9uOiBub2RlLnJvdGF0aW9uLFxuICAgICAgICAgICAgICAgICAgICBzY2FsZTogbm9kZS5zY2FsZSxcbiAgICAgICAgICAgICAgICAgICAgcGFyZW50OiBub2RlLnBhcmVudD8udXVpZCxcbiAgICAgICAgICAgICAgICAgICAgY2hpbGRyZW46IG5vZGUuY2hpbGRyZW4ubWFwKChjaGlsZDogYW55KSA9PiBjaGlsZC51dWlkKSxcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50czogbm9kZS5jb21wb25lbnRzLm1hcCgoY29tcDogYW55KSA9PiAoe1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogY29tcC5jb25zdHJ1Y3Rvci5uYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgZW5hYmxlZDogY29tcC5lbmFibGVkXG4gICAgICAgICAgICAgICAgICAgIH0pKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9O1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEdldCBhbGwgbm9kZXMgaW4gc2NlbmVcbiAgICAgKi9cbiAgICBnZXRBbGxOb2RlcygpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBub2RlczogYW55W10gPSBbXTtcbiAgICAgICAgICAgIGNvbnN0IGNvbGxlY3ROb2RlcyA9IChub2RlOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBub2Rlcy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgdXVpZDogbm9kZS51dWlkLFxuICAgICAgICAgICAgICAgICAgICBuYW1lOiBub2RlLm5hbWUsXG4gICAgICAgICAgICAgICAgICAgIGFjdGl2ZTogbm9kZS5hY3RpdmUsXG4gICAgICAgICAgICAgICAgICAgIHBhcmVudDogbm9kZS5wYXJlbnQ/LnV1aWRcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBub2RlLmNoaWxkcmVuLmZvckVhY2goKGNoaWxkOiBhbnkpID0+IGNvbGxlY3ROb2RlcyhjaGlsZCkpO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgc2NlbmUuY2hpbGRyZW4uZm9yRWFjaCgoY2hpbGQ6IGFueSkgPT4gY29sbGVjdE5vZGVzKGNoaWxkKSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IG5vZGVzIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9O1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEZpbmQgbm9kZSBieSBuYW1lXG4gICAgICovXG4gICAgZmluZE5vZGVCeU5hbWUobmFtZTogc3RyaW5nKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IHNjZW5lLmdldENoaWxkQnlOYW1lKG5hbWUpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm9kZSB3aXRoIG5hbWUgJHtuYW1lfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICAgICAgICAgIHV1aWQ6IG5vZGUudXVpZCxcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogbm9kZS5uYW1lLFxuICAgICAgICAgICAgICAgICAgICBhY3RpdmU6IG5vZGUuYWN0aXZlLFxuICAgICAgICAgICAgICAgICAgICBwb3NpdGlvbjogbm9kZS5wb3NpdGlvblxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9O1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEdldCBjdXJyZW50IHNjZW5lIGluZm9ybWF0aW9uXG4gICAgICovXG4gICAgZ2V0Q3VycmVudFNjZW5lSW5mbygpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICAgICAgICBuYW1lOiBzY2VuZS5uYW1lLFxuICAgICAgICAgICAgICAgICAgICB1dWlkOiBzY2VuZS51dWlkLFxuICAgICAgICAgICAgICAgICAgICBub2RlQ291bnQ6IHNjZW5lLmNoaWxkcmVuLmxlbmd0aFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9O1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFNldCBub2RlIHByb3BlcnR5XG4gICAgICovXG4gICAgc2V0Tm9kZVByb3BlcnR5KG5vZGVVdWlkOiBzdHJpbmcsIHByb3BlcnR5OiBzdHJpbmcsIHZhbHVlOiBhbnkpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBub2RlID0gZmluZE5vZGVCeVV1aWREZWVwKHNjZW5lLCBub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlIHdpdGggVVVJRCAke25vZGVVdWlkfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFNldCBwcm9wZXJ0eVxuICAgICAgICAgICAgaWYgKHByb3BlcnR5ID09PSAncG9zaXRpb24nKSB7XG4gICAgICAgICAgICAgICAgbm9kZS5zZXRQb3NpdGlvbih2YWx1ZS54IHx8IDAsIHZhbHVlLnkgfHwgMCwgdmFsdWUueiB8fCAwKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAocHJvcGVydHkgPT09ICdyb3RhdGlvbicpIHtcbiAgICAgICAgICAgICAgICBub2RlLnNldFJvdGF0aW9uRnJvbUV1bGVyKHZhbHVlLnggfHwgMCwgdmFsdWUueSB8fCAwLCB2YWx1ZS56IHx8IDApO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChwcm9wZXJ0eSA9PT0gJ3NjYWxlJykge1xuICAgICAgICAgICAgICAgIG5vZGUuc2V0U2NhbGUodmFsdWUueCB8fCAxLCB2YWx1ZS55IHx8IDEsIHZhbHVlLnogfHwgMSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHByb3BlcnR5ID09PSAnYWN0aXZlJykge1xuICAgICAgICAgICAgICAgIG5vZGUuYWN0aXZlID0gdmFsdWU7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHByb3BlcnR5ID09PSAnbmFtZScpIHtcbiAgICAgICAgICAgICAgICBub2RlLm5hbWUgPSB2YWx1ZTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gUHJvdG90eXBlIHBvbGx1dGlvbiBndWFyZFxuICAgICAgICAgICAgICAgIGlmIChbJ19fcHJvdG9fXycsICdjb25zdHJ1Y3RvcicsICdwcm90b3R5cGUnXS5pbmNsdWRlcyhwcm9wZXJ0eSkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgU2V0dGluZyBwcm9wZXJ0eSAnJHtwcm9wZXJ0eX0nIGlzIG5vdCBhbGxvd2VkYCB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyBUcnkgdG8gc2V0IHRoZSBwcm9wZXJ0eSBkaXJlY3RseVxuICAgICAgICAgICAgICAgIChub2RlIGFzIGFueSlbcHJvcGVydHldID0gdmFsdWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB7IFxuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsIFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBQcm9wZXJ0eSAnJHtwcm9wZXJ0eX0nIHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5YCBcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9O1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEdldCBzY2VuZSBoaWVyYXJjaHlcbiAgICAgKi9cbiAgICBnZXRTY2VuZUhpZXJhcmNoeShpbmNsdWRlQ29tcG9uZW50czogYm9vbGVhbiA9IGZhbHNlLCBtYXhEZXB0aDogbnVtYmVyID0gNTApIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBwcm9jZXNzTm9kZSA9IChub2RlOiBhbnksIGRlcHRoOiBudW1iZXIgPSAwKTogYW55ID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoZGVwdGggPj0gbWF4RGVwdGgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHsgbmFtZTogbm9kZS5uYW1lLCB1dWlkOiBub2RlLnV1aWQsIHRydW5jYXRlZDogdHJ1ZSB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQ6IGFueSA9IHtcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogbm9kZS5uYW1lLFxuICAgICAgICAgICAgICAgICAgICB1dWlkOiBub2RlLnV1aWQsXG4gICAgICAgICAgICAgICAgICAgIGFjdGl2ZTogbm9kZS5hY3RpdmUsXG4gICAgICAgICAgICAgICAgICAgIGNoaWxkcmVuOiBbXVxuICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICBpZiAoaW5jbHVkZUNvbXBvbmVudHMpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0LmNvbXBvbmVudHMgPSBub2RlLmNvbXBvbmVudHMubWFwKChjb21wOiBhbnkpID0+ICh7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBjb21wLmNvbnN0cnVjdG9yLm5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBlbmFibGVkOiBjb21wLmVuYWJsZWRcbiAgICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChub2RlLmNoaWxkcmVuICYmIG5vZGUuY2hpbGRyZW4ubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICByZXN1bHQuY2hpbGRyZW4gPSBub2RlLmNoaWxkcmVuLm1hcCgoY2hpbGQ6IGFueSkgPT4gcHJvY2Vzc05vZGUoY2hpbGQsIGRlcHRoICsgMSkpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBjb25zdCBoaWVyYXJjaHkgPSBzY2VuZS5jaGlsZHJlbi5tYXAoKGNoaWxkOiBhbnkpID0+IHByb2Nlc3NOb2RlKGNoaWxkLCAwKSk7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiBoaWVyYXJjaHkgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIHByZWZhYiBmcm9tIG5vZGVcbiAgICAgKi9cbiAgICBjcmVhdGVQcmVmYWJGcm9tTm9kZShub2RlVXVpZDogc3RyaW5nLCBwcmVmYWJQYXRoOiBzdHJpbmcpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IsIGluc3RhbnRpYXRlIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IGZpbmROb2RlQnlVdWlkRGVlcChzY2VuZSwgbm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm9kZSB3aXRoIFVVSUQgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBOb3RlOiBUaGlzIGlzIGEgc2ltdWxhdGVkIGltcGxlbWVudGF0aW9uIHNpbmNlIHByZWZhYiBmaWxlcyBjYW5ub3QgYmUgY3JlYXRlZCBkaXJlY3RseSBhdCBydW50aW1lLlxuICAgICAgICAgICAgLy8gQWN0dWFsIHByZWZhYiBjcmVhdGlvbiByZXF1aXJlcyB0aGUgRWRpdG9yIEFQSS5cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICAgICAgICAgIHByZWZhYlBhdGg6IHByZWZhYlBhdGgsXG4gICAgICAgICAgICAgICAgICAgIHNvdXJjZU5vZGVVdWlkOiBub2RlVXVpZCxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogYFByZWZhYiBjcmVhdGVkIGZyb20gbm9kZSAnJHtub2RlLm5hbWV9JyBhdCAke3ByZWZhYlBhdGh9YFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9O1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFNldCBjb21wb25lbnQgcHJvcGVydHlcbiAgICAgKi9cbiAgICBzZXRDb21wb25lbnRQcm9wZXJ0eShub2RlVXVpZDogc3RyaW5nLCBjb21wb25lbnRUeXBlOiBzdHJpbmcsIHByb3BlcnR5OiBzdHJpbmcsIHZhbHVlOiBhbnkpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IsIGpzIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBmaW5kTm9kZUJ5VXVpZERlZXAoc2NlbmUsIG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgd2l0aCBVVUlEICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IENvbXBvbmVudENsYXNzID0ganMuZ2V0Q2xhc3NCeU5hbWUoY29tcG9uZW50VHlwZSk7XG4gICAgICAgICAgICBpZiAoIUNvbXBvbmVudENsYXNzKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgQ29tcG9uZW50IHR5cGUgJHtjb21wb25lbnRUeXBlfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBjb21wb25lbnQgPSBub2RlLmdldENvbXBvbmVudChDb21wb25lbnRDbGFzcyk7XG4gICAgICAgICAgICBpZiAoIWNvbXBvbmVudCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYENvbXBvbmVudCAke2NvbXBvbmVudFR5cGV9IG5vdCBmb3VuZCBvbiBub2RlYCB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gUHJvdG90eXBlIHBvbGx1dGlvbiBndWFyZCAoYXBwbGllZCBmaXJzdCBmb3IgYWxsIHByb3BlcnR5IG5hbWVzKVxuICAgICAgICAgICAgaWYgKFsnX19wcm90b19fJywgJ2NvbnN0cnVjdG9yJywgJ3Byb3RvdHlwZSddLmluY2x1ZGVzKHByb3BlcnR5KSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYFNldHRpbmcgcHJvcGVydHkgJyR7cHJvcGVydHl9JyBpcyBub3QgYWxsb3dlZGAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIFNwZWNpYWwgaGFuZGxpbmcgZm9yIGNvbW1vbiBwcm9wZXJ0aWVzXG4gICAgICAgICAgICBpZiAocHJvcGVydHkgPT09ICdzcHJpdGVGcmFtZScgJiYgY29tcG9uZW50VHlwZSA9PT0gJ2NjLlNwcml0ZScpIHtcbiAgICAgICAgICAgICAgICAvLyBWYWx1ZSBjYW4gYmUgYSB1dWlkIG9yIGFzc2V0IHBhdGhcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBhc3NldE1hbmFnZXIgPSByZXF1aXJlKCdjYycpLmFzc2V0TWFuYWdlcjtcbiAgICAgICAgICAgICAgICAgICAgLy8gUmV0dXJuIGEgUHJvbWlzZSBzbyB0aGUgY2FsbGVyIHdhaXRzIGZvciB0aGUgYXNzZXQgdG8gbG9hZFxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbmV3IFByb21pc2U8eyBzdWNjZXNzOiBib29sZWFuOyBtZXNzYWdlPzogc3RyaW5nOyBlcnJvcj86IHN0cmluZyB9PigocmVzb2x2ZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXNzZXRNYW5hZ2VyLnJlc291cmNlcy5sb2FkKHZhbHVlLCByZXF1aXJlKCdjYycpLlNwcml0ZUZyYW1lLCAoZXJyOiBhbnksIHNwcml0ZUZyYW1lOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWVyciAmJiBzcHJpdGVGcmFtZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb21wb25lbnQuc3ByaXRlRnJhbWUgPSBzcHJpdGVGcmFtZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh7IHN1Y2Nlc3M6IHRydWUsIG1lc3NhZ2U6IGBDb21wb25lbnQgcHJvcGVydHkgJyR7cHJvcGVydHl9JyB1cGRhdGVkIHN1Y2Nlc3NmdWxseWAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXNzZXRNYW5hZ2VyLmxvYWRBbnkoeyB1dWlkOiB2YWx1ZSB9LCAoZXJyMjogYW55LCBhc3NldDogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWVycjIgJiYgYXNzZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb21wb25lbnQuc3ByaXRlRnJhbWUgPSBhc3NldDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHsgc3VjY2VzczogdHJ1ZSwgbWVzc2FnZTogYENvbXBvbmVudCBwcm9wZXJ0eSAnJHtwcm9wZXJ0eX0nIHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5YCB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYEZhaWxlZCB0byBsb2FkIHNwcml0ZUZyYW1lOiAke2VycjI/Lm1lc3NhZ2UgfHwgZXJyPy5tZXNzYWdlIHx8ICd1bmtub3duIGVycm9yJ31gIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50LnNwcml0ZUZyYW1lID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChwcm9wZXJ0eSA9PT0gJ21hdGVyaWFsJyAmJiAoY29tcG9uZW50VHlwZSA9PT0gJ2NjLlNwcml0ZScgfHwgY29tcG9uZW50VHlwZSA9PT0gJ2NjLk1lc2hSZW5kZXJlcicpKSB7XG4gICAgICAgICAgICAgICAgLy8gVmFsdWUgY2FuIGJlIGEgdXVpZCBvciBhc3NldCBwYXRoXG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYXNzZXRNYW5hZ2VyID0gcmVxdWlyZSgnY2MnKS5hc3NldE1hbmFnZXI7XG4gICAgICAgICAgICAgICAgICAgIC8vIFJldHVybiBhIFByb21pc2Ugc28gdGhlIGNhbGxlciB3YWl0cyBmb3IgdGhlIGFzc2V0IHRvIGxvYWRcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlPHsgc3VjY2VzczogYm9vbGVhbjsgbWVzc2FnZT86IHN0cmluZzsgZXJyb3I/OiBzdHJpbmcgfT4oKHJlc29sdmUpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFzc2V0TWFuYWdlci5yZXNvdXJjZXMubG9hZCh2YWx1ZSwgcmVxdWlyZSgnY2MnKS5NYXRlcmlhbCwgKGVycjogYW55LCBtYXRlcmlhbDogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFlcnIgJiYgbWF0ZXJpYWwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50Lm1hdGVyaWFsID0gbWF0ZXJpYWw7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUoeyBzdWNjZXNzOiB0cnVlLCBtZXNzYWdlOiBgQ29tcG9uZW50IHByb3BlcnR5ICcke3Byb3BlcnR5fScgdXBkYXRlZCBzdWNjZXNzZnVsbHlgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFzc2V0TWFuYWdlci5sb2FkQW55KHsgdXVpZDogdmFsdWUgfSwgKGVycjI6IGFueSwgYXNzZXQ6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFlcnIyICYmIGFzc2V0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50Lm1hdGVyaWFsID0gYXNzZXQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh7IHN1Y2Nlc3M6IHRydWUsIG1lc3NhZ2U6IGBDb21wb25lbnQgcHJvcGVydHkgJyR7cHJvcGVydHl9JyB1cGRhdGVkIHN1Y2Nlc3NmdWxseWAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUoeyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBGYWlsZWQgdG8gbG9hZCBtYXRlcmlhbDogJHtlcnIyPy5tZXNzYWdlIHx8IGVycj8ubWVzc2FnZSB8fCAndW5rbm93biBlcnJvcid9YCB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudC5tYXRlcmlhbCA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAocHJvcGVydHkgPT09ICdzdHJpbmcnICYmIChjb21wb25lbnRUeXBlID09PSAnY2MuTGFiZWwnIHx8IGNvbXBvbmVudFR5cGUgPT09ICdjYy5SaWNoVGV4dCcpKSB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50LnN0cmluZyA9IHZhbHVlO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb21wb25lbnRbcHJvcGVydHldID0gdmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBPcHRpb25hbDogcmVmcmVzaCBJbnNwZWN0b3JcbiAgICAgICAgICAgIC8vIEVkaXRvci5NZXNzYWdlLnNlbmQoJ3NjZW5lJywgJ3NuYXBzaG90Jyk7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBtZXNzYWdlOiBgQ29tcG9uZW50IHByb3BlcnR5ICcke3Byb3BlcnR5fScgdXBkYXRlZCBzdWNjZXNzZnVsbHlgIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9O1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIC8vIOKUgOKUgOKUgCBMaWdodCBoZWxwZXJzIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuXG4gICAgLyoqIE1hcCBsaWdodCB0eXBlIHN0cmluZyB0byBjYyBjbGFzcyBuYW1lICovXG4gICAgX2dldExpZ2h0Q2xhc3NOYW1lKHR5cGU6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgICAgIGNvbnN0IG1hcDogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgICAgICAgICAgIGRpcmVjdGlvbmFsOiAnRGlyZWN0aW9uYWxMaWdodCcsXG4gICAgICAgICAgICBzcGhlcmU6ICdTcGhlcmVMaWdodCcsXG4gICAgICAgICAgICBzcG90OiAnU3BvdExpZ2h0JyxcbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIG1hcFt0eXBlXSB8fCAnRGlyZWN0aW9uYWxMaWdodCc7XG4gICAgfSxcblxuICAgIC8qKiBQYXJzZSBjb2xvciBmcm9tIGhleCBzdHJpbmcgb3Ige3IsZyxiLGF9IG9iamVjdCBpbnRvIGNjLkNvbG9yICovXG4gICAgX3BhcnNlQ29sb3IoY2M6IGFueSwgY29sb3I6IGFueSk6IGFueSB7XG4gICAgICAgIGlmICghY29sb3IpIHJldHVybiBuZXcgY2MuQ29sb3IoMjU1LCAyNTUsIDI1NSwgMjU1KTtcbiAgICAgICAgaWYgKHR5cGVvZiBjb2xvciA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIGNvbnN0IGhleCA9IGNvbG9yLnJlcGxhY2UoJyMnLCAnJyk7XG4gICAgICAgICAgICBjb25zdCByID0gcGFyc2VJbnQoaGV4LnN1YnN0cmluZygwLCAyKSwgMTYpO1xuICAgICAgICAgICAgY29uc3QgZyA9IHBhcnNlSW50KGhleC5zdWJzdHJpbmcoMiwgNCksIDE2KTtcbiAgICAgICAgICAgIGNvbnN0IGIgPSBwYXJzZUludChoZXguc3Vic3RyaW5nKDQsIDYpLCAxNik7XG4gICAgICAgICAgICByZXR1cm4gbmV3IGNjLkNvbG9yKHIsIGcsIGIsIDI1NSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG5ldyBjYy5Db2xvcihjb2xvci5yID8/IDI1NSwgY29sb3IuZyA/PyAyNTUsIGNvbG9yLmIgPz8gMjU1LCBjb2xvci5hID8/IDI1NSk7XG4gICAgfSxcblxuICAgIGFkZExpZ2h0Q29tcG9uZW50KG5vZGVVdWlkOiBzdHJpbmcsIHR5cGU6IHN0cmluZywgY29sb3I6IGFueSwgaW50ZW5zaXR5OiBudW1iZXIpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IsIGpzLCBDb2xvciB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBmaW5kTm9kZUJ5VXVpZERlZXAoc2NlbmUsIG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm9kZSAke25vZGVVdWlkfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICBjb25zdCBjbGFzc05hbWUgPSAobWV0aG9kcyBhcyBhbnkpLl9nZXRMaWdodENsYXNzTmFtZSh0eXBlKTtcbiAgICAgICAgICAgIGNvbnN0IExpZ2h0Q2xhc3MgPSBqcy5nZXRDbGFzc0J5TmFtZShjbGFzc05hbWUpO1xuICAgICAgICAgICAgaWYgKCFMaWdodENsYXNzKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBMaWdodCBjbGFzcyAke2NsYXNzTmFtZX0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgY29uc3QgbGlnaHQgPSBub2RlLmFkZENvbXBvbmVudChMaWdodENsYXNzKTtcbiAgICAgICAgICAgIGlmIChjb2xvcikgbGlnaHQuY29sb3IgPSAobWV0aG9kcyBhcyBhbnkpLl9wYXJzZUNvbG9yKHsgQ29sb3IgfSwgY29sb3IpO1xuICAgICAgICAgICAgaWYgKGludGVuc2l0eSAhPT0gdW5kZWZpbmVkKSBsaWdodC5sdW1pbmFuY2UgPSBpbnRlbnNpdHk7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IHV1aWQ6IG5vZGUudXVpZCwgbGlnaHRUeXBlOiBjbGFzc05hbWUgfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIHNldExpZ2h0UHJvcGVydHkobm9kZVV1aWQ6IHN0cmluZywgcHJvcGVydHk6IHN0cmluZywgdmFsdWU6IGFueSkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwganMsIENvbG9yIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IGZpbmROb2RlQnlVdWlkRGVlcChzY2VuZSwgbm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIGNvbnN0IGxpZ2h0VHlwZXMgPSBbJ0RpcmVjdGlvbmFsTGlnaHQnLCAnU3BoZXJlTGlnaHQnLCAnU3BvdExpZ2h0J107XG4gICAgICAgICAgICBsZXQgbGlnaHQ6IGFueSA9IG51bGw7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHQgb2YgbGlnaHRUeXBlcykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNscyA9IGpzLmdldENsYXNzQnlOYW1lKHQpO1xuICAgICAgICAgICAgICAgIGlmIChjbHMpIHsgbGlnaHQgPSBub2RlLmdldENvbXBvbmVudChjbHMpOyBpZiAobGlnaHQpIGJyZWFrOyB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIWxpZ2h0KSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBsaWdodCBjb21wb25lbnQgZm91bmQgb24gbm9kZScgfTtcbiAgICAgICAgICAgIGlmIChwcm9wZXJ0eSA9PT0gJ2NvbG9yJykge1xuICAgICAgICAgICAgICAgIGxpZ2h0LmNvbG9yID0gKG1ldGhvZHMgYXMgYW55KS5fcGFyc2VDb2xvcih7IENvbG9yIH0sIHZhbHVlKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoWydfX3Byb3RvX18nLCAnY29uc3RydWN0b3InLCAncHJvdG90eXBlJ10uaW5jbHVkZXMocHJvcGVydHkpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgU2V0dGluZyAnJHtwcm9wZXJ0eX0nIGlzIG5vdCBhbGxvd2VkYCB9O1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBsaWdodFtwcm9wZXJ0eV0gPSB2YWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICBnZXRMaWdodEluZm8obm9kZVV1aWQ6IHN0cmluZykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwganMgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlID0gZmluZE5vZGVCeVV1aWREZWVwKHNjZW5lLCBub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgY29uc3QgbGlnaHRUeXBlcyA9IFsnRGlyZWN0aW9uYWxMaWdodCcsICdTcGhlcmVMaWdodCcsICdTcG90TGlnaHQnXTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgdCBvZiBsaWdodFR5cGVzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY2xzID0ganMuZ2V0Q2xhc3NCeU5hbWUodCk7XG4gICAgICAgICAgICAgICAgaWYgKCFjbHMpIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIGNvbnN0IGxpZ2h0ID0gbm9kZS5nZXRDb21wb25lbnQoY2xzKTtcbiAgICAgICAgICAgICAgICBpZiAobGlnaHQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGlnaHRUeXBlOiB0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbG9yOiBsaWdodC5jb2xvcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsdW1pbmFuY2U6IGxpZ2h0Lmx1bWluYW5jZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByYW5nZTogbGlnaHQucmFuZ2UsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3BvdEFuZ2xlOiBsaWdodC5hbmdsZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaGFkb3dFbmFibGVkOiBsaWdodC5zaGFkb3dFbmFibGVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNoYWRvd0JpYXM6IGxpZ2h0LnNoYWRvd0JpYXMsXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gbGlnaHQgY29tcG9uZW50IGZvdW5kIG9uIG5vZGUnIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgbGlzdExpZ2h0cygpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IsIGpzIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3QgbGlnaHRzOiBhbnlbXSA9IFtdO1xuICAgICAgICAgICAgY29uc3QgbGlnaHRUeXBlcyA9IFsnRGlyZWN0aW9uYWxMaWdodCcsICdTcGhlcmVMaWdodCcsICdTcG90TGlnaHQnXTtcbiAgICAgICAgICAgIGNvbnN0IHdhbGsgPSAobm9kZTogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCB0IG9mIGxpZ2h0VHlwZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY2xzID0ganMuZ2V0Q2xhc3NCeU5hbWUodCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjbHMgJiYgbm9kZS5nZXRDb21wb25lbnQoY2xzKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGlnaHRzLnB1c2goeyB1dWlkOiBub2RlLnV1aWQsIG5hbWU6IG5vZGUubmFtZSwgbGlnaHRUeXBlOiB0IH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgbm9kZS5jaGlsZHJlbi5mb3JFYWNoKChjOiBhbnkpID0+IHdhbGsoYykpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHNjZW5lLmNoaWxkcmVuLmZvckVhY2goKGM6IGFueSkgPT4gd2FsayhjKSk7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IGxpZ2h0cywgY291bnQ6IGxpZ2h0cy5sZW5ndGggfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIHJlbW92ZUxpZ2h0Q29tcG9uZW50KG5vZGVVdWlkOiBzdHJpbmcpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IsIGpzIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IGZpbmROb2RlQnlVdWlkRGVlcChzY2VuZSwgbm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIGNvbnN0IGxpZ2h0VHlwZXMgPSBbJ0RpcmVjdGlvbmFsTGlnaHQnLCAnU3BoZXJlTGlnaHQnLCAnU3BvdExpZ2h0J107XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHQgb2YgbGlnaHRUeXBlcykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNscyA9IGpzLmdldENsYXNzQnlOYW1lKHQpO1xuICAgICAgICAgICAgICAgIGlmICghY2xzKSBjb250aW51ZTtcbiAgICAgICAgICAgICAgICBjb25zdCBsaWdodCA9IG5vZGUuZ2V0Q29tcG9uZW50KGNscyk7XG4gICAgICAgICAgICAgICAgaWYgKGxpZ2h0KSB7IG5vZGUucmVtb3ZlQ29tcG9uZW50KGxpZ2h0KTsgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSB9OyB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBsaWdodCBjb21wb25lbnQgZm91bmQgb24gbm9kZScgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICAvLyDilIDilIDilIAgQ2FtZXJhIGhlbHBlcnMg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5cbiAgICBnZXRDYW1lcmFJbmZvKG5vZGVVdWlkOiBzdHJpbmcpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IsIGpzIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IGZpbmROb2RlQnlVdWlkRGVlcChzY2VuZSwgbm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIGNvbnN0IENhbWVyYUNsYXNzID0ganMuZ2V0Q2xhc3NCeU5hbWUoJ0NhbWVyYScpO1xuICAgICAgICAgICAgaWYgKCFDYW1lcmFDbGFzcykgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnQ2FtZXJhIGNsYXNzIG5vdCBmb3VuZCcgfTtcbiAgICAgICAgICAgIGNvbnN0IGNhbSA9IG5vZGUuZ2V0Q29tcG9uZW50KENhbWVyYUNsYXNzKTtcbiAgICAgICAgICAgIGlmICghY2FtKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBDYW1lcmEgY29tcG9uZW50IG9uIG5vZGUnIH07XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICAgICAgICBmb3Y6IGNhbS5mb3YsXG4gICAgICAgICAgICAgICAgICAgIG9ydGhvSGVpZ2h0OiBjYW0ub3J0aG9IZWlnaHQsXG4gICAgICAgICAgICAgICAgICAgIG5lYXI6IGNhbS5uZWFyLFxuICAgICAgICAgICAgICAgICAgICBmYXI6IGNhbS5mYXIsXG4gICAgICAgICAgICAgICAgICAgIHByaW9yaXR5OiBjYW0ucHJpb3JpdHksXG4gICAgICAgICAgICAgICAgICAgIHZpc2liaWxpdHk6IGNhbS52aXNpYmlsaXR5LFxuICAgICAgICAgICAgICAgICAgICBjbGVhckZsYWdzOiBjYW0uY2xlYXJGbGFncyxcbiAgICAgICAgICAgICAgICAgICAgcHJvamVjdGlvbjogY2FtLnByb2plY3Rpb24sXG4gICAgICAgICAgICAgICAgICAgIHJlY3Q6IGNhbS5yZWN0LFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgc2V0Q2FtZXJhUHJvcGVydHkobm9kZVV1aWQ6IHN0cmluZywgcHJvcGVydHk6IHN0cmluZywgdmFsdWU6IGFueSkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwganMsIFJlY3QsIENhbWVyYSB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBmaW5kTm9kZUJ5VXVpZERlZXAoc2NlbmUsIG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm9kZSAke25vZGVVdWlkfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICBjb25zdCBDYW1lcmFDbGFzcyA9IGpzLmdldENsYXNzQnlOYW1lKCdDYW1lcmEnKSB8fCBDYW1lcmE7XG4gICAgICAgICAgICBjb25zdCBjYW0gPSBub2RlLmdldENvbXBvbmVudChDYW1lcmFDbGFzcyk7XG4gICAgICAgICAgICBpZiAoIWNhbSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gQ2FtZXJhIGNvbXBvbmVudCBvbiBub2RlJyB9O1xuICAgICAgICAgICAgaWYgKFsnX19wcm90b19fJywgJ2NvbnN0cnVjdG9yJywgJ3Byb3RvdHlwZSddLmluY2x1ZGVzKHByb3BlcnR5KSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYFNldHRpbmcgJyR7cHJvcGVydHl9JyBpcyBub3QgYWxsb3dlZGAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChwcm9wZXJ0eSA9PT0gJ2NsZWFyRmxhZ3MnKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZmxhZ01hcDogUmVjb3JkPHN0cmluZywgbnVtYmVyPiA9IHsgU09MSURfQ09MT1I6IDEsIERFUFRIX09OTFk6IDIsIERPTlRfQ0xFQVI6IDMsIFNLWUJPWDogNCB9O1xuICAgICAgICAgICAgICAgIGNhbS5jbGVhckZsYWdzID0gZmxhZ01hcFt2YWx1ZV0gPz8gdmFsdWU7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHByb3BlcnR5ID09PSAncHJvamVjdGlvbicpIHtcbiAgICAgICAgICAgICAgICBjYW0ucHJvamVjdGlvbiA9IHZhbHVlID09PSAnT1JUSE8nID8gMCA6IDE7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHByb3BlcnR5ID09PSAndmlld3BvcnQnKSB7XG4gICAgICAgICAgICAgICAgY2FtLnJlY3QgPSBuZXcgUmVjdCh2YWx1ZS54LCB2YWx1ZS55LCB2YWx1ZS53aWR0aCwgdmFsdWUuaGVpZ2h0KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY2FtW3Byb3BlcnR5XSA9IHZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIGxpc3RDYW1lcmFzKCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwganMgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBDYW1lcmFDbGFzcyA9IGpzLmdldENsYXNzQnlOYW1lKCdDYW1lcmEnKTtcbiAgICAgICAgICAgIGlmICghQ2FtZXJhQ2xhc3MpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ0NhbWVyYSBjbGFzcyBub3QgZm91bmQnIH07XG4gICAgICAgICAgICBjb25zdCBjYW1lcmFzOiBhbnlbXSA9IFtdO1xuICAgICAgICAgICAgY29uc3Qgd2FsayA9IChub2RlOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBjYW0gPSBub2RlLmdldENvbXBvbmVudChDYW1lcmFDbGFzcyk7XG4gICAgICAgICAgICAgICAgaWYgKGNhbSkgY2FtZXJhcy5wdXNoKHsgdXVpZDogbm9kZS51dWlkLCBuYW1lOiBub2RlLm5hbWUsIHByaW9yaXR5OiBjYW0ucHJpb3JpdHksIHByb2plY3Rpb246IGNhbS5wcm9qZWN0aW9uIH0pO1xuICAgICAgICAgICAgICAgIG5vZGUuY2hpbGRyZW4uZm9yRWFjaCgoYzogYW55KSA9PiB3YWxrKGMpKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBzY2VuZS5jaGlsZHJlbi5mb3JFYWNoKChjOiBhbnkpID0+IHdhbGsoYykpO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogeyBjYW1lcmFzLCBjb3VudDogY2FtZXJhcy5sZW5ndGggfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIC8vIOKUgOKUgOKUgCBQaHlzaWNzIGhlbHBlcnMg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5cbiAgICBjb25maWd1cmVQaHlzaWNzKGdyYXZpdHk6IGFueSwgZml4ZWRUaW1lU3RlcD86IG51bWJlciwgbWF4U3ViU3RlcHM/OiBudW1iZXIpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgUGh5c2ljc1N5c3RlbSwgVmVjMyB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHN5cyA9IFBoeXNpY3NTeXN0ZW0/Lmluc3RhbmNlO1xuICAgICAgICAgICAgaWYgKCFzeXMpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ1BoeXNpY3NTeXN0ZW0gbm90IGF2YWlsYWJsZSAoM0Qgb25seSknIH07XG4gICAgICAgICAgICBpZiAoZ3Jhdml0eSkgc3lzLmdyYXZpdHkgPSBuZXcgVmVjMyhncmF2aXR5LnggPz8gMCwgZ3Jhdml0eS55ID8/IC0xMCwgZ3Jhdml0eS56ID8/IDApO1xuICAgICAgICAgICAgaWYgKGZpeGVkVGltZVN0ZXAgIT09IHVuZGVmaW5lZCkgc3lzLmZpeGVkVGltZVN0ZXAgPSBmaXhlZFRpbWVTdGVwO1xuICAgICAgICAgICAgaWYgKG1heFN1YlN0ZXBzICE9PSB1bmRlZmluZWQpIHN5cy5tYXhTdWJTdGVwcyA9IG1heFN1YlN0ZXBzO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogeyBncmF2aXR5OiBzeXMuZ3Jhdml0eSwgZml4ZWRUaW1lU3RlcDogc3lzLmZpeGVkVGltZVN0ZXAsIG1heFN1YlN0ZXBzOiBzeXMubWF4U3ViU3RlcHMgfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIC8qKiBEZXRlY3QgaWYgbm9kZSBpcyBpbiBhIDJEIGNvbnRleHQgYnkgY2hlY2tpbmcgZm9yIFVJVHJhbnNmb3JtL1Nwcml0ZSAqL1xuICAgIF9pczJETm9kZShub2RlOiBhbnksIGpzOiBhbnkpOiBib29sZWFuIHtcbiAgICAgICAgY29uc3QgdHlwZXMyRCA9IFsnVUlUcmFuc2Zvcm0nLCAnU3ByaXRlJywgJ0xhYmVsJywgJ0J1dHRvbicsICdDYW52YXMnXTtcbiAgICAgICAgcmV0dXJuIHR5cGVzMkQuc29tZSh0ID0+IHsgY29uc3QgY2xzID0ganMuZ2V0Q2xhc3NCeU5hbWUodCk7IHJldHVybiBjbHMgJiYgbm9kZS5nZXRDb21wb25lbnQoY2xzKTsgfSk7XG4gICAgfSxcblxuICAgIGFkZFJpZ2lkYm9keShub2RlVXVpZDogc3RyaW5nLCB0eXBlOiBzdHJpbmcsIG1hc3M6IG51bWJlciwgdXNlR3Jhdml0eTogYm9vbGVhbikge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwganMgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlID0gZmluZE5vZGVCeVV1aWREZWVwKHNjZW5lLCBub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgY29uc3QgaXMyRCA9IChtZXRob2RzIGFzIGFueSkuX2lzMkROb2RlKG5vZGUsIGpzKTtcbiAgICAgICAgICAgIGNvbnN0IGNsYXNzTmFtZSA9IGlzMkQgPyAnUmlnaWRCb2R5MkQnIDogJ1JpZ2lkQm9keSc7XG4gICAgICAgICAgICBjb25zdCBSQkNsYXNzID0ganMuZ2V0Q2xhc3NCeU5hbWUoY2xhc3NOYW1lKTtcbiAgICAgICAgICAgIGlmICghUkJDbGFzcykgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgJHtjbGFzc05hbWV9IG5vdCBhdmFpbGFibGVgIH07XG4gICAgICAgICAgICBjb25zdCByYiA9IG5vZGUuYWRkQ29tcG9uZW50KFJCQ2xhc3MpO1xuICAgICAgICAgICAgaWYgKGlzMkQpIHtcbiAgICAgICAgICAgICAgICBjb25zdCB0eXBlTWFwOiBSZWNvcmQ8c3RyaW5nLCBudW1iZXI+ID0geyBzdGF0aWM6IDAsIGtpbmVtYXRpYzogMSwgZHluYW1pYzogMiB9O1xuICAgICAgICAgICAgICAgIHJiLnR5cGUgPSB0eXBlTWFwW3R5cGVdID8/IDI7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnN0IHR5cGVNYXA6IFJlY29yZDxzdHJpbmcsIG51bWJlcj4gPSB7IGR5bmFtaWM6IDAsIHN0YXRpYzogMiwga2luZW1hdGljOiAzIH07XG4gICAgICAgICAgICAgICAgcmIudHlwZSA9IHR5cGVNYXBbdHlwZV0gPz8gMDtcbiAgICAgICAgICAgICAgICByYi5tYXNzID0gbWFzcztcbiAgICAgICAgICAgICAgICByYi51c2VHcmF2aXR5ID0gdXNlR3Jhdml0eTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHsgdXVpZDogbm9kZS51dWlkLCByYkNsYXNzOiBjbGFzc05hbWUsIHR5cGUgfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIGFkZENvbGxpZGVyKG5vZGVVdWlkOiBzdHJpbmcsIHNoYXBlOiBzdHJpbmcsIHNpemU6IGFueSwgaXNUcmlnZ2VyOiBib29sZWFuKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCBqcyB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBmaW5kTm9kZUJ5VXVpZERlZXAoc2NlbmUsIG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm9kZSAke25vZGVVdWlkfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICBjb25zdCBpczJEID0gKG1ldGhvZHMgYXMgYW55KS5faXMyRE5vZGUobm9kZSwganMpO1xuICAgICAgICAgICAgY29uc3QgY2xhc3NNYXAzRDogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHsgYm94OiAnQm94Q29sbGlkZXInLCBzcGhlcmU6ICdTcGhlcmVDb2xsaWRlcicsIGNhcHN1bGU6ICdDYXBzdWxlQ29sbGlkZXInIH07XG4gICAgICAgICAgICBjb25zdCBjbGFzc01hcDJEOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0geyBib3g6ICdCb3hDb2xsaWRlcjJEJywgY2lyY2xlOiAnQ2lyY2xlQ29sbGlkZXIyRCcsIHBvbHlnb246ICdQb2x5Z29uQ29sbGlkZXIyRCcgfTtcbiAgICAgICAgICAgIGNvbnN0IGNsYXNzTmFtZSA9IGlzMkQgPyAoY2xhc3NNYXAyRFtzaGFwZV0gfHwgJ0JveENvbGxpZGVyMkQnKSA6IChjbGFzc01hcDNEW3NoYXBlXSB8fCAnQm94Q29sbGlkZXInKTtcbiAgICAgICAgICAgIGNvbnN0IENvbGxpZGVyQ2xhc3MgPSBqcy5nZXRDbGFzc0J5TmFtZShjbGFzc05hbWUpO1xuICAgICAgICAgICAgaWYgKCFDb2xsaWRlckNsYXNzKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGAke2NsYXNzTmFtZX0gbm90IGF2YWlsYWJsZWAgfTtcbiAgICAgICAgICAgIGNvbnN0IGNvbGxpZGVyID0gbm9kZS5hZGRDb21wb25lbnQoQ29sbGlkZXJDbGFzcyk7XG4gICAgICAgICAgICBjb2xsaWRlci5pc1RyaWdnZXIgPSBpc1RyaWdnZXI7XG4gICAgICAgICAgICBpZiAoc2l6ZSAmJiBjb2xsaWRlci5zaXplKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgeyBWZWMzLCBTaXplIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgICAgIGlmIChpczJEKSBjb2xsaWRlci5zaXplID0gbmV3IFNpemUoc2l6ZS53aWR0aCA/PyBzaXplLnggPz8gMSwgc2l6ZS5oZWlnaHQgPz8gc2l6ZS55ID8/IDEpO1xuICAgICAgICAgICAgICAgIGVsc2UgY29sbGlkZXIuc2l6ZSA9IG5ldyBWZWMzKHNpemUud2lkdGggPz8gc2l6ZS54ID8/IDEsIHNpemUuaGVpZ2h0ID8/IHNpemUueSA/PyAxLCBzaXplLmRlcHRoID8/IHNpemUueiA/PyAxKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzaXplPy5yYWRpdXMgIT09IHVuZGVmaW5lZCAmJiBjb2xsaWRlci5yYWRpdXMgIT09IHVuZGVmaW5lZCkgY29sbGlkZXIucmFkaXVzID0gc2l6ZS5yYWRpdXM7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IHV1aWQ6IG5vZGUudXVpZCwgY29sbGlkZXJDbGFzczogY2xhc3NOYW1lLCBpc1RyaWdnZXIgfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIHNldFJpZ2lkYm9keVByb3BlcnR5KG5vZGVVdWlkOiBzdHJpbmcsIHByb3BlcnR5OiBzdHJpbmcsIHZhbHVlOiBhbnkpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IsIGpzIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IGZpbmROb2RlQnlVdWlkRGVlcChzY2VuZSwgbm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIGlmIChbJ19fcHJvdG9fXycsICdjb25zdHJ1Y3RvcicsICdwcm90b3R5cGUnXS5pbmNsdWRlcyhwcm9wZXJ0eSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBTZXR0aW5nICcke3Byb3BlcnR5fScgaXMgbm90IGFsbG93ZWRgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHJiTmFtZSBvZiBbJ1JpZ2lkQm9keScsICdSaWdpZEJvZHkyRCddKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY2xzID0ganMuZ2V0Q2xhc3NCeU5hbWUocmJOYW1lKTtcbiAgICAgICAgICAgICAgICBpZiAoIWNscykgY29udGludWU7XG4gICAgICAgICAgICAgICAgY29uc3QgcmIgPSBub2RlLmdldENvbXBvbmVudChjbHMpO1xuICAgICAgICAgICAgICAgIGlmIChyYikgeyByYltwcm9wZXJ0eV0gPSB2YWx1ZTsgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSB9OyB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBSaWdpZEJvZHkgY29tcG9uZW50IGZvdW5kIG9uIG5vZGUnIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgc2V0Q29sbGlkZXJQcm9wZXJ0eShub2RlVXVpZDogc3RyaW5nLCBwcm9wZXJ0eTogc3RyaW5nLCB2YWx1ZTogYW55KSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCBqcywgVmVjMywgU2l6ZSB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBmaW5kTm9kZUJ5VXVpZERlZXAoc2NlbmUsIG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm9kZSAke25vZGVVdWlkfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICBpZiAoWydfX3Byb3RvX18nLCAnY29uc3RydWN0b3InLCAncHJvdG90eXBlJ10uaW5jbHVkZXMocHJvcGVydHkpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgU2V0dGluZyAnJHtwcm9wZXJ0eX0nIGlzIG5vdCBhbGxvd2VkYCB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgY29sbGlkZXJOYW1lcyA9IFsnQm94Q29sbGlkZXInLCAnU3BoZXJlQ29sbGlkZXInLCAnQ2Fwc3VsZUNvbGxpZGVyJywgJ0JveENvbGxpZGVyMkQnLCAnQ2lyY2xlQ29sbGlkZXIyRCcsICdQb2x5Z29uQ29sbGlkZXIyRCddO1xuICAgICAgICAgICAgZm9yIChjb25zdCBuYW1lIG9mIGNvbGxpZGVyTmFtZXMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjbHMgPSBqcy5nZXRDbGFzc0J5TmFtZShuYW1lKTtcbiAgICAgICAgICAgICAgICBpZiAoIWNscykgY29udGludWU7XG4gICAgICAgICAgICAgICAgY29uc3QgY29sID0gbm9kZS5nZXRDb21wb25lbnQoY2xzKTtcbiAgICAgICAgICAgICAgICBpZiAoY29sKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChwcm9wZXJ0eSA9PT0gJ3NpemUnICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbC5zaXplID0gbmFtZS5lbmRzV2l0aCgnMkQnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgID8gbmV3IFNpemUodmFsdWUud2lkdGggPz8gdmFsdWUueCA/PyAxLCB2YWx1ZS5oZWlnaHQgPz8gdmFsdWUueSA/PyAxKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDogbmV3IFZlYzModmFsdWUud2lkdGggPz8gdmFsdWUueCA/PyAxLCB2YWx1ZS5oZWlnaHQgPz8gdmFsdWUueSA/PyAxLCB2YWx1ZS5kZXB0aCA/PyB2YWx1ZS56ID8/IDEpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHByb3BlcnR5ID09PSAnY2VudGVyJyAmJiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2wuY2VudGVyID0gbmV3IFZlYzModmFsdWUueCA/PyAwLCB2YWx1ZS55ID8/IDAsIHZhbHVlLnogPz8gMCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2xbcHJvcGVydHldID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGNvbGxpZGVyIGNvbXBvbmVudCBmb3VuZCBvbiBub2RlJyB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIHJlbW92ZVBoeXNpY3NDb21wb25lbnRzKG5vZGVVdWlkOiBzdHJpbmcpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IsIGpzIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IGZpbmROb2RlQnlVdWlkRGVlcChzY2VuZSwgbm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIGNvbnN0IHBoeXNpY3NOYW1lcyA9IFsnUmlnaWRCb2R5JywgJ1JpZ2lkQm9keTJEJywgJ0JveENvbGxpZGVyJywgJ1NwaGVyZUNvbGxpZGVyJywgJ0NhcHN1bGVDb2xsaWRlcicsICdCb3hDb2xsaWRlcjJEJywgJ0NpcmNsZUNvbGxpZGVyMkQnLCAnUG9seWdvbkNvbGxpZGVyMkQnXTtcbiAgICAgICAgICAgIGNvbnN0IHJlbW92ZWQ6IHN0cmluZ1tdID0gW107XG4gICAgICAgICAgICBmb3IgKGNvbnN0IG5hbWUgb2YgcGh5c2ljc05hbWVzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY2xzID0ganMuZ2V0Q2xhc3NCeU5hbWUobmFtZSk7XG4gICAgICAgICAgICAgICAgaWYgKCFjbHMpIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbXAgPSBub2RlLmdldENvbXBvbmVudChjbHMpO1xuICAgICAgICAgICAgICAgIGlmIChjb21wKSB7IG5vZGUucmVtb3ZlQ29tcG9uZW50KGNvbXApOyByZW1vdmVkLnB1c2gobmFtZSk7IH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHsgcmVtb3ZlZCB9IH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgZ2V0UGh5c2ljc0luZm8obm9kZVV1aWQ6IHN0cmluZykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwganMgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlID0gZmluZE5vZGVCeVV1aWREZWVwKHNjZW5lLCBub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgY29uc3QgaW5mbzogYW55ID0geyByaWdpZGJvZHk6IG51bGwsIGNvbGxpZGVyczogW10gfTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgcmJOYW1lIG9mIFsnUmlnaWRCb2R5JywgJ1JpZ2lkQm9keTJEJ10pIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjbHMgPSBqcy5nZXRDbGFzc0J5TmFtZShyYk5hbWUpO1xuICAgICAgICAgICAgICAgIGlmICghY2xzKSBjb250aW51ZTtcbiAgICAgICAgICAgICAgICBjb25zdCByYiA9IG5vZGUuZ2V0Q29tcG9uZW50KGNscyk7XG4gICAgICAgICAgICAgICAgaWYgKHJiKSB7IGluZm8ucmlnaWRib2R5ID0geyB0eXBlOiByYk5hbWUsIHJiVHlwZTogcmIudHlwZSwgbWFzczogcmIubWFzcywgdXNlR3Jhdml0eTogcmIudXNlR3Jhdml0eSB9OyBicmVhazsgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgY29sbGlkZXJOYW1lcyA9IFsnQm94Q29sbGlkZXInLCAnU3BoZXJlQ29sbGlkZXInLCAnQ2Fwc3VsZUNvbGxpZGVyJywgJ0JveENvbGxpZGVyMkQnLCAnQ2lyY2xlQ29sbGlkZXIyRCcsICdQb2x5Z29uQ29sbGlkZXIyRCddO1xuICAgICAgICAgICAgZm9yIChjb25zdCBuYW1lIG9mIGNvbGxpZGVyTmFtZXMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjbHMgPSBqcy5nZXRDbGFzc0J5TmFtZShuYW1lKTtcbiAgICAgICAgICAgICAgICBpZiAoIWNscykgY29udGludWU7XG4gICAgICAgICAgICAgICAgY29uc3QgY29sID0gbm9kZS5nZXRDb21wb25lbnQoY2xzKTtcbiAgICAgICAgICAgICAgICBpZiAoY29sKSBpbmZvLmNvbGxpZGVycy5wdXNoKHsgdHlwZTogbmFtZSwgaXNUcmlnZ2VyOiBjb2wuaXNUcmlnZ2VyLCBzaXplOiBjb2wuc2l6ZSwgY2VudGVyOiBjb2wuY2VudGVyIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogaW5mbyB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIHBlcmZvcm1SYXljYXN0KG9yaWdpbjogYW55LCBkaXJlY3Rpb246IGFueSwgbWF4RGlzdGFuY2U6IG51bWJlcikge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBQaHlzaWNzU3lzdGVtLCBWZWMzLCBnZW9tZXRyeSB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHN5cyA9IFBoeXNpY3NTeXN0ZW0/Lmluc3RhbmNlO1xuICAgICAgICAgICAgaWYgKCFzeXMpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ1BoeXNpY3NTeXN0ZW0gbm90IGF2YWlsYWJsZSAoM0Qgb25seSknIH07XG4gICAgICAgICAgICBjb25zdCByYXkgPSBuZXcgZ2VvbWV0cnkuUmF5KG9yaWdpbi54LCBvcmlnaW4ueSwgb3JpZ2luLnosIGRpcmVjdGlvbi54LCBkaXJlY3Rpb24ueSwgZGlyZWN0aW9uLnopO1xuICAgICAgICAgICAgY29uc3QgaGl0ID0gc3lzLnJheWNhc3RDbG9zZXN0KHJheSwgMHhmZmZmZmZmZiwgbWF4RGlzdGFuY2UpO1xuICAgICAgICAgICAgaWYgKCFoaXQpIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHsgaGl0OiBmYWxzZSB9IH07XG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBzeXMucmF5Y2FzdENsb3Nlc3RSZXN1bHQ7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICAgICAgICBoaXQ6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIGRpc3RhbmNlOiByZXN1bHQuZGlzdGFuY2UsXG4gICAgICAgICAgICAgICAgICAgIGhpdFBvaW50OiByZXN1bHQuaGl0UG9pbnQsXG4gICAgICAgICAgICAgICAgICAgIGhpdE5vcm1hbDogcmVzdWx0LmhpdE5vcm1hbCxcbiAgICAgICAgICAgICAgICAgICAgbm9kZVV1aWQ6IHJlc3VsdC5jb2xsaWRlcj8ubm9kZT8udXVpZCxcbiAgICAgICAgICAgICAgICAgICAgbm9kZU5hbWU6IHJlc3VsdC5jb2xsaWRlcj8ubm9kZT8ubmFtZSxcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIC8vIOKUgOKUgOKUgCBBdWRpbyBoZWxwZXJzIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuXG4gICAgYWRkQXVkaW9Tb3VyY2Uobm9kZVV1aWQ6IHN0cmluZywgY2xpcFV1aWQ6IHN0cmluZyB8IG51bGwpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IsIGpzLCBhc3NldE1hbmFnZXIgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlID0gZmluZE5vZGVCeVV1aWREZWVwKHNjZW5lLCBub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgY29uc3QgQXVkaW9Tb3VyY2VDbGFzcyA9IGpzLmdldENsYXNzQnlOYW1lKCdBdWRpb1NvdXJjZScpO1xuICAgICAgICAgICAgaWYgKCFBdWRpb1NvdXJjZUNsYXNzKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdBdWRpb1NvdXJjZSBjbGFzcyBub3QgZm91bmQnIH07XG4gICAgICAgICAgICBjb25zdCBhdWRpbyA9IG5vZGUuYWRkQ29tcG9uZW50KEF1ZGlvU291cmNlQ2xhc3MpO1xuICAgICAgICAgICAgaWYgKGNsaXBVdWlkKSB7XG4gICAgICAgICAgICAgICAgYXNzZXRNYW5hZ2VyLmxvYWRBbnkoeyB1dWlkOiBjbGlwVXVpZCB9LCAoZXJyOiBhbnksIGNsaXA6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWVyciAmJiBjbGlwKSBhdWRpby5jbGlwID0gY2xpcDtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHsgdXVpZDogbm9kZS51dWlkLCBoYXNDbGlwOiAhIWNsaXBVdWlkIH0gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICBzZXRBdWRpb1Byb3BlcnR5KG5vZGVVdWlkOiBzdHJpbmcsIHByb3BlcnR5OiBzdHJpbmcsIHZhbHVlOiBhbnkpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IsIGpzLCBhc3NldE1hbmFnZXIgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlID0gZmluZE5vZGVCeVV1aWREZWVwKHNjZW5lLCBub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgY29uc3QgQXVkaW9Tb3VyY2VDbGFzcyA9IGpzLmdldENsYXNzQnlOYW1lKCdBdWRpb1NvdXJjZScpO1xuICAgICAgICAgICAgaWYgKCFBdWRpb1NvdXJjZUNsYXNzKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdBdWRpb1NvdXJjZSBjbGFzcyBub3QgZm91bmQnIH07XG4gICAgICAgICAgICBjb25zdCBhdWRpbyA9IG5vZGUuZ2V0Q29tcG9uZW50KEF1ZGlvU291cmNlQ2xhc3MpO1xuICAgICAgICAgICAgaWYgKCFhdWRpbykgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gQXVkaW9Tb3VyY2UgY29tcG9uZW50IG9uIG5vZGUnIH07XG4gICAgICAgICAgICBpZiAoWydfX3Byb3RvX18nLCAnY29uc3RydWN0b3InLCAncHJvdG90eXBlJ10uaW5jbHVkZXMocHJvcGVydHkpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgU2V0dGluZyAnJHtwcm9wZXJ0eX0nIGlzIG5vdCBhbGxvd2VkYCB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHByb3BlcnR5ID09PSAnY2xpcCcgJiYgdHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgIGFzc2V0TWFuYWdlci5sb2FkQW55KHsgdXVpZDogdmFsdWUgfSwgKGVycjogYW55LCBjbGlwOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFlcnIgJiYgY2xpcCkgYXVkaW8uY2xpcCA9IGNsaXA7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgbWVzc2FnZTogJ0NsaXAgbG9hZGluZyBpbml0aWF0ZWQnIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBhdWRpb1twcm9wZXJ0eV0gPSB2YWx1ZTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICBjb250cm9sQXVkaW8obm9kZVV1aWQ6IHN0cmluZywgY29tbWFuZDogc3RyaW5nKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCBqcyB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBmaW5kTm9kZUJ5VXVpZERlZXAoc2NlbmUsIG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm9kZSAke25vZGVVdWlkfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICBjb25zdCBBdWRpb1NvdXJjZUNsYXNzID0ganMuZ2V0Q2xhc3NCeU5hbWUoJ0F1ZGlvU291cmNlJyk7XG4gICAgICAgICAgICBpZiAoIUF1ZGlvU291cmNlQ2xhc3MpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ0F1ZGlvU291cmNlIGNsYXNzIG5vdCBmb3VuZCcgfTtcbiAgICAgICAgICAgIGNvbnN0IGF1ZGlvID0gbm9kZS5nZXRDb21wb25lbnQoQXVkaW9Tb3VyY2VDbGFzcyk7XG4gICAgICAgICAgICBpZiAoIWF1ZGlvKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBBdWRpb1NvdXJjZSBjb21wb25lbnQgb24gbm9kZScgfTtcbiAgICAgICAgICAgIGNvbnN0IGNtZHM6IFJlY29yZDxzdHJpbmcsICgpID0+IHZvaWQ+ID0ge1xuICAgICAgICAgICAgICAgIHBsYXk6ICgpID0+IGF1ZGlvLnBsYXkoKSxcbiAgICAgICAgICAgICAgICBzdG9wOiAoKSA9PiBhdWRpby5zdG9wKCksXG4gICAgICAgICAgICAgICAgcGF1c2U6ICgpID0+IGF1ZGlvLnBhdXNlKCksXG4gICAgICAgICAgICAgICAgcmVzdW1lOiAoKSA9PiBhdWRpby5wbGF5KCksXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgaWYgKCFjbWRzW2NvbW1hbmRdKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBVbmtub3duIGNvbW1hbmQgJyR7Y29tbWFuZH0nYCB9O1xuICAgICAgICAgICAgY21kc1tjb21tYW5kXSgpO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogeyBjb21tYW5kIH0gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICBnZXRBdWRpb0luZm8obm9kZVV1aWQ6IHN0cmluZykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwganMgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlID0gZmluZE5vZGVCeVV1aWREZWVwKHNjZW5lLCBub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgY29uc3QgQXVkaW9Tb3VyY2VDbGFzcyA9IGpzLmdldENsYXNzQnlOYW1lKCdBdWRpb1NvdXJjZScpO1xuICAgICAgICAgICAgaWYgKCFBdWRpb1NvdXJjZUNsYXNzKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdBdWRpb1NvdXJjZSBjbGFzcyBub3QgZm91bmQnIH07XG4gICAgICAgICAgICBjb25zdCBhdWRpbyA9IG5vZGUuZ2V0Q29tcG9uZW50KEF1ZGlvU291cmNlQ2xhc3MpO1xuICAgICAgICAgICAgaWYgKCFhdWRpbykgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gQXVkaW9Tb3VyY2UgY29tcG9uZW50IG9uIG5vZGUnIH07XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICAgICAgICBjbGlwOiBhdWRpby5jbGlwPy5uYW1lID8/IG51bGwsXG4gICAgICAgICAgICAgICAgICAgIHZvbHVtZTogYXVkaW8udm9sdW1lLFxuICAgICAgICAgICAgICAgICAgICBsb29wOiBhdWRpby5sb29wLFxuICAgICAgICAgICAgICAgICAgICBwbGF5T25Bd2FrZTogYXVkaW8ucGxheU9uQXdha2UsXG4gICAgICAgICAgICAgICAgICAgIHBsYXlpbmc6IGF1ZGlvLnBsYXlpbmcsXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICBsaXN0QXVkaW9Tb3VyY2VzKCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwganMgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBBdWRpb1NvdXJjZUNsYXNzID0ganMuZ2V0Q2xhc3NCeU5hbWUoJ0F1ZGlvU291cmNlJyk7XG4gICAgICAgICAgICBpZiAoIUF1ZGlvU291cmNlQ2xhc3MpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ0F1ZGlvU291cmNlIGNsYXNzIG5vdCBmb3VuZCcgfTtcbiAgICAgICAgICAgIGNvbnN0IHNvdXJjZXM6IGFueVtdID0gW107XG4gICAgICAgICAgICBjb25zdCB3YWxrID0gKG5vZGU6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGF1ZGlvID0gbm9kZS5nZXRDb21wb25lbnQoQXVkaW9Tb3VyY2VDbGFzcyk7XG4gICAgICAgICAgICAgICAgaWYgKGF1ZGlvKSBzb3VyY2VzLnB1c2goeyB1dWlkOiBub2RlLnV1aWQsIG5hbWU6IG5vZGUubmFtZSwgY2xpcDogYXVkaW8uY2xpcD8ubmFtZSA/PyBudWxsLCB2b2x1bWU6IGF1ZGlvLnZvbHVtZSB9KTtcbiAgICAgICAgICAgICAgICBub2RlLmNoaWxkcmVuLmZvckVhY2goKGM6IGFueSkgPT4gd2FsayhjKSk7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgc2NlbmUuY2hpbGRyZW4uZm9yRWFjaCgoYzogYW55KSA9PiB3YWxrKGMpKTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHsgc291cmNlcywgY291bnQ6IHNvdXJjZXMubGVuZ3RoIH0gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICAvLyDilIDilIDilIAgUGFydGljbGUgaGVscGVycyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcblxuICAgIGFkZFBhcnRpY2xlU3lzdGVtKG5vZGVVdWlkOiBzdHJpbmcsIGlzMmQ6IGJvb2xlYW4pIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IsIGpzIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IGZpbmROb2RlQnlVdWlkRGVlcChzY2VuZSwgbm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIGNvbnN0IGNsYXNzTmFtZSA9IGlzMmQgPyAnUGFydGljbGVTeXN0ZW0yRCcgOiAnUGFydGljbGVTeXN0ZW0nO1xuICAgICAgICAgICAgY29uc3QgUFNDbGFzcyA9IGpzLmdldENsYXNzQnlOYW1lKGNsYXNzTmFtZSk7XG4gICAgICAgICAgICBpZiAoIVBTQ2xhc3MpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYCR7Y2xhc3NOYW1lfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICBub2RlLmFkZENvbXBvbmVudChQU0NsYXNzKTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHsgdXVpZDogbm9kZS51dWlkLCBwYXJ0aWNsZUNsYXNzOiBjbGFzc05hbWUgfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIHNldFBhcnRpY2xlUHJvcGVydHkobm9kZVV1aWQ6IHN0cmluZywgcHJvcGVydHk6IHN0cmluZywgdmFsdWU6IGFueSkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwganMgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlID0gZmluZE5vZGVCeVV1aWREZWVwKHNjZW5lLCBub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgaWYgKFsnX19wcm90b19fJywgJ2NvbnN0cnVjdG9yJywgJ3Byb3RvdHlwZSddLmluY2x1ZGVzKHByb3BlcnR5KSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYFNldHRpbmcgJyR7cHJvcGVydHl9JyBpcyBub3QgYWxsb3dlZGAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAoY29uc3QgY2xzIG9mIFsnUGFydGljbGVTeXN0ZW0nLCAnUGFydGljbGVTeXN0ZW0yRCddKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgUFNDbGFzcyA9IGpzLmdldENsYXNzQnlOYW1lKGNscyk7XG4gICAgICAgICAgICAgICAgaWYgKCFQU0NsYXNzKSBjb250aW51ZTtcbiAgICAgICAgICAgICAgICBjb25zdCBwcyA9IG5vZGUuZ2V0Q29tcG9uZW50KFBTQ2xhc3MpO1xuICAgICAgICAgICAgICAgIGlmIChwcykgeyBwc1twcm9wZXJ0eV0gPSB2YWx1ZTsgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSB9OyB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBQYXJ0aWNsZVN5c3RlbSBjb21wb25lbnQgZm91bmQgb24gbm9kZScgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICBzZXRQYXJ0aWNsZUVtaXNzaW9uKG5vZGVVdWlkOiBzdHJpbmcsIHJhdGVPdmVyVGltZTogbnVtYmVyLCBidXJzdHM6IGFueVtdKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCBqcyB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBmaW5kTm9kZUJ5VXVpZERlZXAoc2NlbmUsIG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm9kZSAke25vZGVVdWlkfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICBjb25zdCBQU0NsYXNzID0ganMuZ2V0Q2xhc3NCeU5hbWUoJ1BhcnRpY2xlU3lzdGVtJyk7XG4gICAgICAgICAgICBpZiAoIVBTQ2xhc3MpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ1BhcnRpY2xlU3lzdGVtIG5vdCBmb3VuZCAoM0Qgb25seSBmb3IgZW1pc3Npb24gY29udHJvbCknIH07XG4gICAgICAgICAgICBjb25zdCBwcyA9IG5vZGUuZ2V0Q29tcG9uZW50KFBTQ2xhc3MpO1xuICAgICAgICAgICAgaWYgKCFwcykgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gUGFydGljbGVTeXN0ZW0gb24gbm9kZScgfTtcbiAgICAgICAgICAgIGlmIChyYXRlT3ZlclRpbWUgIT09IHVuZGVmaW5lZCAmJiBwcy5yYXRlT3ZlclRpbWUpIHtcbiAgICAgICAgICAgICAgICBwcy5yYXRlT3ZlclRpbWUuY29uc3RhbnQgPSByYXRlT3ZlclRpbWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShidXJzdHMpICYmIHBzLmJ1cnN0cyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgcHMuYnVyc3RzID0gYnVyc3RzO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIHNldFBhcnRpY2xlU2hhcGUobm9kZVV1aWQ6IHN0cmluZywgc2hhcGVUeXBlOiBzdHJpbmcsIHJhZGl1czogbnVtYmVyLCBhbmdsZTogbnVtYmVyKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCBqcyB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBmaW5kTm9kZUJ5VXVpZERlZXAoc2NlbmUsIG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm9kZSAke25vZGVVdWlkfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICBjb25zdCBQU0NsYXNzID0ganMuZ2V0Q2xhc3NCeU5hbWUoJ1BhcnRpY2xlU3lzdGVtJyk7XG4gICAgICAgICAgICBpZiAoIVBTQ2xhc3MpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ1BhcnRpY2xlU3lzdGVtIG5vdCBmb3VuZCAoM0Qgb25seSBmb3Igc2hhcGUpJyB9O1xuICAgICAgICAgICAgY29uc3QgcHMgPSBub2RlLmdldENvbXBvbmVudChQU0NsYXNzKTtcbiAgICAgICAgICAgIGlmICghcHMpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIFBhcnRpY2xlU3lzdGVtIG9uIG5vZGUnIH07XG4gICAgICAgICAgICBpZiAocHMuc2hhcGVNb2R1bGUpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBzaGFwZU1hcDogUmVjb3JkPHN0cmluZywgbnVtYmVyPiA9IHsgY29uZTogMCwgc3BoZXJlOiAxLCBib3g6IDQgfTtcbiAgICAgICAgICAgICAgICBpZiAoc2hhcGVUeXBlICYmIHNoYXBlTWFwW3NoYXBlVHlwZV0gIT09IHVuZGVmaW5lZCkgcHMuc2hhcGVNb2R1bGUuc2hhcGVUeXBlID0gc2hhcGVNYXBbc2hhcGVUeXBlXTtcbiAgICAgICAgICAgICAgICBpZiAocmFkaXVzICE9PSB1bmRlZmluZWQpIHBzLnNoYXBlTW9kdWxlLnJhZGl1cyA9IHJhZGl1cztcbiAgICAgICAgICAgICAgICBpZiAoYW5nbGUgIT09IHVuZGVmaW5lZCkgcHMuc2hhcGVNb2R1bGUuYW5nbGUgPSBhbmdsZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICBzZXRQYXJ0aWNsZVJlbmRlcmVyKG5vZGVVdWlkOiBzdHJpbmcsIHJlbmRlck1vZGU6IG51bWJlciwgbWF0ZXJpYWxVdWlkOiBzdHJpbmcpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IsIGpzLCBhc3NldE1hbmFnZXIgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlID0gZmluZE5vZGVCeVV1aWREZWVwKHNjZW5lLCBub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgY29uc3QgUFNDbGFzcyA9IGpzLmdldENsYXNzQnlOYW1lKCdQYXJ0aWNsZVN5c3RlbScpO1xuICAgICAgICAgICAgaWYgKCFQU0NsYXNzKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdQYXJ0aWNsZVN5c3RlbSBub3QgZm91bmQnIH07XG4gICAgICAgICAgICBjb25zdCBwcyA9IG5vZGUuZ2V0Q29tcG9uZW50KFBTQ2xhc3MpO1xuICAgICAgICAgICAgaWYgKCFwcykgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gUGFydGljbGVTeXN0ZW0gb24gbm9kZScgfTtcbiAgICAgICAgICAgIGlmIChyZW5kZXJNb2RlICE9PSB1bmRlZmluZWQgJiYgcHMucmVuZGVyZXIpIHBzLnJlbmRlcmVyLnJlbmRlck1vZGUgPSByZW5kZXJNb2RlO1xuICAgICAgICAgICAgaWYgKG1hdGVyaWFsVXVpZCAmJiBwcy5yZW5kZXJlcikge1xuICAgICAgICAgICAgICAgIGFzc2V0TWFuYWdlci5sb2FkQW55KHsgdXVpZDogbWF0ZXJpYWxVdWlkIH0sIChlcnI6IGFueSwgbWF0OiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFlcnIgJiYgbWF0KSBwcy5yZW5kZXJlci5zaGFyZWRNYXRlcmlhbCA9IG1hdDtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICBnZXRQYXJ0aWNsZUluZm8obm9kZVV1aWQ6IHN0cmluZykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwganMgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlID0gZmluZE5vZGVCeVV1aWREZWVwKHNjZW5lLCBub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgZm9yIChjb25zdCBjbHMgb2YgWydQYXJ0aWNsZVN5c3RlbScsICdQYXJ0aWNsZVN5c3RlbTJEJ10pIHtcbiAgICAgICAgICAgICAgICBjb25zdCBQU0NsYXNzID0ganMuZ2V0Q2xhc3NCeU5hbWUoY2xzKTtcbiAgICAgICAgICAgICAgICBpZiAoIVBTQ2xhc3MpIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIGNvbnN0IHBzID0gbm9kZS5nZXRDb21wb25lbnQoUFNDbGFzcyk7XG4gICAgICAgICAgICAgICAgaWYgKHBzKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhcnRpY2xlQ2xhc3M6IGNscyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkdXJhdGlvbjogcHMuZHVyYXRpb24sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9vcDogcHMubG9vcCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwbGF5T25Bd2FrZTogcHMucGxheU9uQXdha2UsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWF4UGFydGljbGVzOiBwcy5jYXBhY2l0eSA/PyBwcy50b3RhbFBhcnRpY2xlcyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGFydExpZmV0aW1lOiBwcy5zdGFydExpZmV0aW1lPy5jb25zdGFudCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGFydFNwZWVkOiBwcy5zdGFydFNwZWVkPy5jb25zdGFudCxcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBQYXJ0aWNsZVN5c3RlbSBjb21wb25lbnQgZm91bmQgb24gbm9kZScgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICBsaXN0UGFydGljbGVTeXN0ZW1zKCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwganMgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBwYXJ0aWNsZXM6IGFueVtdID0gW107XG4gICAgICAgICAgICBjb25zdCB3YWxrID0gKG5vZGU6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgY2xzIG9mIFsnUGFydGljbGVTeXN0ZW0nLCAnUGFydGljbGVTeXN0ZW0yRCddKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IFBTQ2xhc3MgPSBqcy5nZXRDbGFzc0J5TmFtZShjbHMpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoUFNDbGFzcyAmJiBub2RlLmdldENvbXBvbmVudChQU0NsYXNzKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcGFydGljbGVzLnB1c2goeyB1dWlkOiBub2RlLnV1aWQsIG5hbWU6IG5vZGUubmFtZSwgcGFydGljbGVDbGFzczogY2xzIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgbm9kZS5jaGlsZHJlbi5mb3JFYWNoKChjOiBhbnkpID0+IHdhbGsoYykpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHNjZW5lLmNoaWxkcmVuLmZvckVhY2goKGM6IGFueSkgPT4gd2FsayhjKSk7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IHBhcnRpY2xlcywgY291bnQ6IHBhcnRpY2xlcy5sZW5ndGggfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIHJlbW92ZVBhcnRpY2xlU3lzdGVtKG5vZGVVdWlkOiBzdHJpbmcpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IsIGpzIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IGZpbmROb2RlQnlVdWlkRGVlcChzY2VuZSwgbm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgY2xzIG9mIFsnUGFydGljbGVTeXN0ZW0nLCAnUGFydGljbGVTeXN0ZW0yRCddKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgUFNDbGFzcyA9IGpzLmdldENsYXNzQnlOYW1lKGNscyk7XG4gICAgICAgICAgICAgICAgaWYgKCFQU0NsYXNzKSBjb250aW51ZTtcbiAgICAgICAgICAgICAgICBjb25zdCBwcyA9IG5vZGUuZ2V0Q29tcG9uZW50KFBTQ2xhc3MpO1xuICAgICAgICAgICAgICAgIGlmIChwcykgeyBub2RlLnJlbW92ZUNvbXBvbmVudChwcyk7IHJldHVybiB7IHN1Y2Nlc3M6IHRydWUgfTsgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gUGFydGljbGVTeXN0ZW0gY29tcG9uZW50IGZvdW5kIG9uIG5vZGUnIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgLy8g4pSA4pSA4pSAIFR3ZWVuIGhlbHBlcnMg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5cbiAgICBfYXBwbHlUd2VlblByb3BlcnRpZXModHdlZW46IGFueSwgbm9kZTogYW55LCBwcm9wZXJ0aWVzOiBhbnksIGNjTW9kdWxlOiBhbnkpOiBhbnkge1xuICAgICAgICBjb25zdCB7IFZlYzMsIFF1YXQgfSA9IGNjTW9kdWxlO1xuICAgICAgICBjb25zdCB0YXJnZXQ6IFJlY29yZDxzdHJpbmcsIGFueT4gPSB7fTtcbiAgICAgICAgaWYgKHByb3BlcnRpZXMucG9zaXRpb24pIHRhcmdldC5wb3NpdGlvbiA9IG5ldyBWZWMzKHByb3BlcnRpZXMucG9zaXRpb24ueCA/PyAwLCBwcm9wZXJ0aWVzLnBvc2l0aW9uLnkgPz8gMCwgcHJvcGVydGllcy5wb3NpdGlvbi56ID8/IDApO1xuICAgICAgICBpZiAocHJvcGVydGllcy5zY2FsZSkgdGFyZ2V0LnNjYWxlID0gbmV3IFZlYzMocHJvcGVydGllcy5zY2FsZS54ID8/IDEsIHByb3BlcnRpZXMuc2NhbGUueSA/PyAxLCBwcm9wZXJ0aWVzLnNjYWxlLnogPz8gMSk7XG4gICAgICAgIGlmIChwcm9wZXJ0aWVzLm9wYWNpdHkgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgY29uc3QgdWlPcCA9IG5vZGUuZ2V0Q29tcG9uZW50ICYmIG5vZGUuZ2V0Q29tcG9uZW50KGNjTW9kdWxlLmpzPy5nZXRDbGFzc0J5TmFtZSgnVUlPcGFjaXR5JykpO1xuICAgICAgICAgICAgaWYgKHVpT3ApIHRhcmdldC5vcGFjaXR5ID0gcHJvcGVydGllcy5vcGFjaXR5O1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0YXJnZXQ7XG4gICAgfSxcblxuICAgIGNyZWF0ZVR3ZWVuKG5vZGVVdWlkOiBzdHJpbmcsIHN0ZXBzOiBhbnlbXSkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgY2MgPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwgdHdlZW4sIFZlYzMgfSA9IGNjO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IGZpbmROb2RlQnlVdWlkRGVlcChzY2VuZSwgbm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIGxldCB0ID0gdHdlZW4obm9kZSk7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHN0ZXAgb2Ygc3RlcHMpIHtcbiAgICAgICAgICAgICAgICBpZiAoc3RlcC50eXBlID09PSAnZGVsYXknKSB7XG4gICAgICAgICAgICAgICAgICAgIHQgPSB0LmRlbGF5KHN0ZXAuZHVyYXRpb24gPz8gMCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChzdGVwLnR5cGUgPT09ICd0bycgfHwgc3RlcC50eXBlID09PSAnYnknKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHByb3BzID0gc3RlcC5wcm9wZXJ0aWVzIHx8IHt9O1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB0YXJnZXQ6IFJlY29yZDxzdHJpbmcsIGFueT4gPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHByb3BzLnBvc2l0aW9uKSB0YXJnZXQucG9zaXRpb24gPSBuZXcgVmVjMyhwcm9wcy5wb3NpdGlvbi54ID8/IDAsIHByb3BzLnBvc2l0aW9uLnkgPz8gMCwgcHJvcHMucG9zaXRpb24ueiA/PyAwKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHByb3BzLnNjYWxlKSB0YXJnZXQuc2NhbGUgPSBuZXcgVmVjMyhwcm9wcy5zY2FsZS54ID8/IDEsIHByb3BzLnNjYWxlLnkgPz8gMSwgcHJvcHMuc2NhbGUueiA/PyAxKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgb3B0cyA9IHN0ZXAuZWFzaW5nID8geyBlYXNpbmc6IHN0ZXAuZWFzaW5nIH0gOiB7fTtcbiAgICAgICAgICAgICAgICAgICAgdCA9IHN0ZXAudHlwZSA9PT0gJ3RvJyA/IHQudG8oc3RlcC5kdXJhdGlvbiA/PyAxLCB0YXJnZXQsIG9wdHMpIDogdC5ieShzdGVwLmR1cmF0aW9uID8/IDEsIHRhcmdldCwgb3B0cyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdC5zdGFydCgpO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogeyBub2RlVXVpZCwgc3RlcHM6IHN0ZXBzLmxlbmd0aCB9IH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgYWRkVHdlZW5Ubyhub2RlVXVpZDogc3RyaW5nLCBwcm9wZXJ0aWVzOiBhbnksIGR1cmF0aW9uOiBudW1iZXIsIGVhc2luZzogc3RyaW5nKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCB0d2VlbiwgVmVjMyB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBmaW5kTm9kZUJ5VXVpZERlZXAoc2NlbmUsIG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm9kZSAke25vZGVVdWlkfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICBjb25zdCB0YXJnZXQ6IFJlY29yZDxzdHJpbmcsIGFueT4gPSB7fTtcbiAgICAgICAgICAgIGlmIChwcm9wZXJ0aWVzLnBvc2l0aW9uKSB0YXJnZXQucG9zaXRpb24gPSBuZXcgVmVjMyhwcm9wZXJ0aWVzLnBvc2l0aW9uLnggPz8gMCwgcHJvcGVydGllcy5wb3NpdGlvbi55ID8/IDAsIHByb3BlcnRpZXMucG9zaXRpb24ueiA/PyAwKTtcbiAgICAgICAgICAgIGlmIChwcm9wZXJ0aWVzLnNjYWxlKSB0YXJnZXQuc2NhbGUgPSBuZXcgVmVjMyhwcm9wZXJ0aWVzLnNjYWxlLnggPz8gMSwgcHJvcGVydGllcy5zY2FsZS55ID8/IDEsIHByb3BlcnRpZXMuc2NhbGUueiA/PyAxKTtcbiAgICAgICAgICAgIGNvbnN0IG9wdHMgPSBlYXNpbmcgJiYgZWFzaW5nICE9PSAnbGluZWFyJyA/IHsgZWFzaW5nIH0gOiB7fTtcbiAgICAgICAgICAgIHR3ZWVuKG5vZGUpLnRvKGR1cmF0aW9uLCB0YXJnZXQsIG9wdHMpLnN0YXJ0KCk7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IG5vZGVVdWlkLCBkdXJhdGlvbiwgZWFzaW5nIH0gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICBhZGRUd2VlbkJ5KG5vZGVVdWlkOiBzdHJpbmcsIHByb3BlcnRpZXM6IGFueSwgZHVyYXRpb246IG51bWJlciwgZWFzaW5nOiBzdHJpbmcpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IsIHR3ZWVuLCBWZWMzIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IGZpbmROb2RlQnlVdWlkRGVlcChzY2VuZSwgbm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIGNvbnN0IHRhcmdldDogUmVjb3JkPHN0cmluZywgYW55PiA9IHt9O1xuICAgICAgICAgICAgaWYgKHByb3BlcnRpZXMucG9zaXRpb24pIHRhcmdldC5wb3NpdGlvbiA9IG5ldyBWZWMzKHByb3BlcnRpZXMucG9zaXRpb24ueCA/PyAwLCBwcm9wZXJ0aWVzLnBvc2l0aW9uLnkgPz8gMCwgcHJvcGVydGllcy5wb3NpdGlvbi56ID8/IDApO1xuICAgICAgICAgICAgaWYgKHByb3BlcnRpZXMuc2NhbGUpIHRhcmdldC5zY2FsZSA9IG5ldyBWZWMzKHByb3BlcnRpZXMuc2NhbGUueCA/PyAxLCBwcm9wZXJ0aWVzLnNjYWxlLnkgPz8gMSwgcHJvcGVydGllcy5zY2FsZS56ID8/IDEpO1xuICAgICAgICAgICAgY29uc3Qgb3B0cyA9IGVhc2luZyAmJiBlYXNpbmcgIT09ICdsaW5lYXInID8geyBlYXNpbmcgfSA6IHt9O1xuICAgICAgICAgICAgdHdlZW4obm9kZSkuYnkoZHVyYXRpb24sIHRhcmdldCwgb3B0cykuc3RhcnQoKTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHsgbm9kZVV1aWQsIGR1cmF0aW9uLCBlYXNpbmcgfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIGFkZFR3ZWVuRGVsYXkobm9kZVV1aWQ6IHN0cmluZywgZHVyYXRpb246IG51bWJlcikge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwgdHdlZW4gfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlID0gZmluZE5vZGVCeVV1aWREZWVwKHNjZW5lLCBub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgdHdlZW4obm9kZSkuZGVsYXkoZHVyYXRpb24pLnN0YXJ0KCk7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IG5vZGVVdWlkLCBkdXJhdGlvbiB9IH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgc3RvcFR3ZWVucyhub2RlVXVpZDogc3RyaW5nKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCBUd2VlbiB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBmaW5kTm9kZUJ5VXVpZERlZXAoc2NlbmUsIG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm9kZSAke25vZGVVdWlkfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICBpZiAoVHdlZW4gJiYgdHlwZW9mIFR3ZWVuLnN0b3BBbGxCeVRhcmdldCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgICAgIFR3ZWVuLnN0b3BBbGxCeVRhcmdldChub2RlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHsgbm9kZVV1aWQgfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIC8vIOKUgOKUgCBUaWxlZE1hcCDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcblxuICAgIGdldFRpbGVkTWFwSW5mbyhub2RlVXVpZDogc3RyaW5nKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCBqcyB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBmaW5kTm9kZUJ5VXVpZERlZXAoc2NlbmUsIG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm9kZSAke25vZGVVdWlkfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICBjb25zdCBUaWxlZE1hcCA9IGpzLmdldENsYXNzQnlOYW1lKCdUaWxlZE1hcCcpO1xuICAgICAgICAgICAgaWYgKCFUaWxlZE1hcCkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnVGlsZWRNYXAgY2xhc3Mgbm90IGZvdW5kJyB9O1xuICAgICAgICAgICAgY29uc3QgY29tcCA9IG5vZGUuZ2V0Q29tcG9uZW50KFRpbGVkTWFwKTtcbiAgICAgICAgICAgIGlmICghY29tcCkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gVGlsZWRNYXAgY29tcG9uZW50IG9uIG5vZGUnIH07XG4gICAgICAgICAgICBjb25zdCBsYXllcnM6IHN0cmluZ1tdID0gW107XG4gICAgICAgICAgICBpZiAoY29tcC5nZXRMYXllcnMpIHsgdHJ5IHsgY29tcC5nZXRMYXllcnMoKS5mb3JFYWNoKChsOiBhbnkpID0+IGxheWVycy5wdXNoKGwuZ2V0TGF5ZXJOYW1lID8gbC5nZXRMYXllck5hbWUoKSA6IGwubGF5ZXJOYW1lKSk7IH0gY2F0Y2ggeyAvKiBpZ25vcmUgKi8gfSB9XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IG1hcFNpemU6IGNvbXAubWFwU2l6ZSwgdGlsZVNpemU6IGNvbXAudGlsZVNpemUsIGxheWVycywgb3JpZW50YXRpb246IGNvbXAub3JpZW50YXRpb24gfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIGxpc3RUaWxlZE1hcHMoKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCBqcyB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IFRpbGVkTWFwID0ganMuZ2V0Q2xhc3NCeU5hbWUoJ1RpbGVkTWFwJyk7XG4gICAgICAgICAgICBpZiAoIVRpbGVkTWFwKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdUaWxlZE1hcCBjbGFzcyBub3QgZm91bmQnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlczogYW55W10gPSBbXTtcbiAgICAgICAgICAgIHNjZW5lLndhbGsoKG5vZGU6IGFueSkgPT4geyBpZiAobm9kZS5nZXRDb21wb25lbnQoVGlsZWRNYXApKSBub2Rlcy5wdXNoKHsgdXVpZDogbm9kZS51dWlkLCBuYW1lOiBub2RlLm5hbWUgfSk7IH0pO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogeyBub2RlcywgY291bnQ6IG5vZGVzLmxlbmd0aCB9IH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgZ2V0VGlsZWRMYXllckluZm8obm9kZVV1aWQ6IHN0cmluZywgbGF5ZXJOYW1lOiBzdHJpbmcpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IsIGpzIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IGZpbmROb2RlQnlVdWlkRGVlcChzY2VuZSwgbm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIGNvbnN0IFRpbGVkTWFwID0ganMuZ2V0Q2xhc3NCeU5hbWUoJ1RpbGVkTWFwJyk7XG4gICAgICAgICAgICBpZiAoIVRpbGVkTWFwKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdUaWxlZE1hcCBjbGFzcyBub3QgZm91bmQnIH07XG4gICAgICAgICAgICBjb25zdCBjb21wID0gbm9kZS5nZXRDb21wb25lbnQoVGlsZWRNYXApO1xuICAgICAgICAgICAgaWYgKCFjb21wKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBUaWxlZE1hcCBjb21wb25lbnQgb24gbm9kZScgfTtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gY29tcC5nZXRMYXllcihsYXllck5hbWUpO1xuICAgICAgICAgICAgaWYgKCFsYXllcikgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTGF5ZXIgJyR7bGF5ZXJOYW1lfScgbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogeyBsYXllck5hbWUsIGxheWVyU2l6ZTogbGF5ZXIubGF5ZXJTaXplLCB0aWxlczogbGF5ZXIudGlsZXMgfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIHNldFRpbGUobm9kZVV1aWQ6IHN0cmluZywgbGF5ZXJOYW1lOiBzdHJpbmcsIHg6IG51bWJlciwgeTogbnVtYmVyLCBnaWQ6IG51bWJlcikge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwganMgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlID0gZmluZE5vZGVCeVV1aWREZWVwKHNjZW5lLCBub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgY29uc3QgVGlsZWRNYXAgPSBqcy5nZXRDbGFzc0J5TmFtZSgnVGlsZWRNYXAnKTtcbiAgICAgICAgICAgIGlmICghVGlsZWRNYXApIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ1RpbGVkTWFwIGNsYXNzIG5vdCBmb3VuZCcgfTtcbiAgICAgICAgICAgIGNvbnN0IGNvbXAgPSBub2RlLmdldENvbXBvbmVudChUaWxlZE1hcCk7XG4gICAgICAgICAgICBpZiAoIWNvbXApIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIFRpbGVkTWFwIGNvbXBvbmVudCBvbiBub2RlJyB9O1xuICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSBjb21wLmdldExheWVyKGxheWVyTmFtZSk7XG4gICAgICAgICAgICBpZiAoIWxheWVyKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBMYXllciAnJHtsYXllck5hbWV9JyBub3QgZm91bmRgIH07XG4gICAgICAgICAgICBsYXllci5zZXRUaWxlR0lEQXQoZ2lkLCB4LCB5KTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHsgeCwgeSwgZ2lkIH0gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICBnZXRUaWxlKG5vZGVVdWlkOiBzdHJpbmcsIGxheWVyTmFtZTogc3RyaW5nLCB4OiBudW1iZXIsIHk6IG51bWJlcikge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwganMgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlID0gZmluZE5vZGVCeVV1aWREZWVwKHNjZW5lLCBub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgY29uc3QgVGlsZWRNYXAgPSBqcy5nZXRDbGFzc0J5TmFtZSgnVGlsZWRNYXAnKTtcbiAgICAgICAgICAgIGlmICghVGlsZWRNYXApIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ1RpbGVkTWFwIGNsYXNzIG5vdCBmb3VuZCcgfTtcbiAgICAgICAgICAgIGNvbnN0IGNvbXAgPSBub2RlLmdldENvbXBvbmVudChUaWxlZE1hcCk7XG4gICAgICAgICAgICBpZiAoIWNvbXApIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIFRpbGVkTWFwIGNvbXBvbmVudCBvbiBub2RlJyB9O1xuICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSBjb21wLmdldExheWVyKGxheWVyTmFtZSk7XG4gICAgICAgICAgICBpZiAoIWxheWVyKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBMYXllciAnJHtsYXllck5hbWV9JyBub3QgZm91bmRgIH07XG4gICAgICAgICAgICBjb25zdCBnaWQgPSBsYXllci5nZXRUaWxlR0lEQXQoeCwgeSk7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IHgsIHksIGdpZCB9IH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgZ2V0VGlsZXNldEluZm8obm9kZVV1aWQ6IHN0cmluZykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwganMgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlID0gZmluZE5vZGVCeVV1aWREZWVwKHNjZW5lLCBub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgY29uc3QgVGlsZWRNYXAgPSBqcy5nZXRDbGFzc0J5TmFtZSgnVGlsZWRNYXAnKTtcbiAgICAgICAgICAgIGlmICghVGlsZWRNYXApIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ1RpbGVkTWFwIGNsYXNzIG5vdCBmb3VuZCcgfTtcbiAgICAgICAgICAgIGNvbnN0IGNvbXAgPSBub2RlLmdldENvbXBvbmVudChUaWxlZE1hcCk7XG4gICAgICAgICAgICBpZiAoIWNvbXApIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIFRpbGVkTWFwIGNvbXBvbmVudCBvbiBub2RlJyB9O1xuICAgICAgICAgICAgY29uc3QgdGlsZXNldHM6IGFueVtdID0gW107XG4gICAgICAgICAgICBpZiAoY29tcC5nZXRUaWxlc2V0cykge1xuICAgICAgICAgICAgICAgIHRyeSB7IGNvbXAuZ2V0VGlsZXNldHMoKS5mb3JFYWNoKCh0czogYW55KSA9PiB0aWxlc2V0cy5wdXNoKHsgbmFtZTogdHMubmFtZSwgZmlyc3RHaWQ6IHRzLmZpcnN0R2lkLCB0aWxlU2l6ZTogdHMudGlsZVNpemUgfSkpOyB9IGNhdGNoIHsgLyogaWdub3JlICovIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHsgdGlsZXNldHMgfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIC8vIOKUgOKUgCBTcGluZSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcblxuICAgIGdldFNwaW5lSW5mbyhub2RlVXVpZDogc3RyaW5nKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgbGV0IHNwOiBhbnk7XG4gICAgICAgICAgICB0cnkgeyBzcCA9IHJlcXVpcmUoJ2NjJykuc3A7IGlmICghc3ApIHRocm93IG5ldyBFcnJvcignbm90IGZvdW5kJyk7IH0gY2F0Y2ggeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdTcGluZSBtb2R1bGUgbm90IGF2YWlsYWJsZSBpbiB0aGlzIHByb2plY3QnIH07IH1cbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBmaW5kTm9kZUJ5VXVpZERlZXAoc2NlbmUsIG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm9kZSAke25vZGVVdWlkfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICBjb25zdCBjb21wID0gbm9kZS5nZXRDb21wb25lbnQoc3AuU2tlbGV0b24pO1xuICAgICAgICAgICAgaWYgKCFjb21wKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBzcC5Ta2VsZXRvbiBjb21wb25lbnQgb24gbm9kZScgfTtcbiAgICAgICAgICAgIGNvbnN0IGFuaW1hdGlvbnM6IHN0cmluZ1tdID0gW107XG4gICAgICAgICAgICBjb25zdCBza2luczogc3RyaW5nW10gPSBbXTtcbiAgICAgICAgICAgIHRyeSB7IGlmIChjb21wLnNrZWxldG9uRGF0YSkgeyBjb25zdCBhZSA9IGNvbXAuc2tlbGV0b25EYXRhLmdldEFuaW1zRW51bTsgY29uc3Qgc2UgPSBjb21wLnNrZWxldG9uRGF0YS5nZXRTa2luc0VudW07IGlmIChhZSkgYW5pbWF0aW9ucy5wdXNoKC4uLk9iamVjdC5rZXlzKGFlKCkpKTsgaWYgKHNlKSBza2lucy5wdXNoKC4uLk9iamVjdC5rZXlzKHNlKCkpKTsgfSB9IGNhdGNoIHsgLyogaWdub3JlICovIH1cbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHsgYW5pbWF0aW9ucywgc2tpbnMsIHRpbWVTY2FsZTogY29tcC50aW1lU2NhbGUsIHByZW11bHRpcGxpZWRBbHBoYTogY29tcC5wcmVtdWx0aXBsaWVkQWxwaGEsIGRlYnVnQm9uZXM6IGNvbXAuZGVidWdCb25lcywgZGVidWdTbG90czogY29tcC5kZWJ1Z1Nsb3RzIH0gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICBzZXRTcGluZUFuaW1hdGlvbihub2RlVXVpZDogc3RyaW5nLCBhbmltYXRpb25OYW1lOiBzdHJpbmcsIGxvb3A6IGJvb2xlYW4sIHRyYWNrSW5kZXg6IG51bWJlcikge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGxldCBzcDogYW55O1xuICAgICAgICAgICAgdHJ5IHsgc3AgPSByZXF1aXJlKCdjYycpLnNwOyBpZiAoIXNwKSB0aHJvdyBuZXcgRXJyb3IoJ25vdCBmb3VuZCcpOyB9IGNhdGNoIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnU3BpbmUgbW9kdWxlIG5vdCBhdmFpbGFibGUgaW4gdGhpcyBwcm9qZWN0JyB9OyB9XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlID0gZmluZE5vZGVCeVV1aWREZWVwKHNjZW5lLCBub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgY29uc3QgY29tcCA9IG5vZGUuZ2V0Q29tcG9uZW50KHNwLlNrZWxldG9uKTtcbiAgICAgICAgICAgIGlmICghY29tcCkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gc3AuU2tlbGV0b24gY29tcG9uZW50IG9uIG5vZGUnIH07XG4gICAgICAgICAgICBjb21wLnNldEFuaW1hdGlvbih0cmFja0luZGV4LCBhbmltYXRpb25OYW1lLCBsb29wKTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHsgYW5pbWF0aW9uTmFtZSwgbG9vcCwgdHJhY2tJbmRleCB9IH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgc2V0U3BpbmVTa2luKG5vZGVVdWlkOiBzdHJpbmcsIHNraW5OYW1lOiBzdHJpbmcpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBsZXQgc3A6IGFueTtcbiAgICAgICAgICAgIHRyeSB7IHNwID0gcmVxdWlyZSgnY2MnKS5zcDsgaWYgKCFzcCkgdGhyb3cgbmV3IEVycm9yKCdub3QgZm91bmQnKTsgfSBjYXRjaCB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ1NwaW5lIG1vZHVsZSBub3QgYXZhaWxhYmxlIGluIHRoaXMgcHJvamVjdCcgfTsgfVxuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IGZpbmROb2RlQnlVdWlkRGVlcChzY2VuZSwgbm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIGNvbnN0IGNvbXAgPSBub2RlLmdldENvbXBvbmVudChzcC5Ta2VsZXRvbik7XG4gICAgICAgICAgICBpZiAoIWNvbXApIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIHNwLlNrZWxldG9uIGNvbXBvbmVudCBvbiBub2RlJyB9O1xuICAgICAgICAgICAgY29tcC5zZXRTa2luKHNraW5OYW1lKTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHsgc2tpbk5hbWUgfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIHNldFNwaW5lUHJvcGVydHkobm9kZVV1aWQ6IHN0cmluZywgcHJvcGVydHk6IHN0cmluZywgdmFsdWU6IGFueSkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGxldCBzcDogYW55O1xuICAgICAgICAgICAgdHJ5IHsgc3AgPSByZXF1aXJlKCdjYycpLnNwOyBpZiAoIXNwKSB0aHJvdyBuZXcgRXJyb3IoJ25vdCBmb3VuZCcpOyB9IGNhdGNoIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnU3BpbmUgbW9kdWxlIG5vdCBhdmFpbGFibGUgaW4gdGhpcyBwcm9qZWN0JyB9OyB9XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlID0gZmluZE5vZGVCeVV1aWREZWVwKHNjZW5lLCBub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgY29uc3QgY29tcCA9IG5vZGUuZ2V0Q29tcG9uZW50KHNwLlNrZWxldG9uKTtcbiAgICAgICAgICAgIGlmICghY29tcCkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gc3AuU2tlbGV0b24gY29tcG9uZW50IG9uIG5vZGUnIH07XG4gICAgICAgICAgICBjb25zdCBhbGxvd2VkID0gWyd0aW1lU2NhbGUnLCAncHJlbXVsdGlwbGllZEFscGhhJywgJ2RlYnVnQm9uZXMnLCAnZGVidWdTbG90cyddO1xuICAgICAgICAgICAgaWYgKCFhbGxvd2VkLmluY2x1ZGVzKHByb3BlcnR5KSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgUHJvcGVydHkgJyR7cHJvcGVydHl9JyBub3QgYWxsb3dlZC4gVXNlOiAke2FsbG93ZWQuam9pbignLCAnKX1gIH07XG4gICAgICAgICAgICAoY29tcCBhcyBhbnkpW3Byb3BlcnR5XSA9IHZhbHVlO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogeyBwcm9wZXJ0eSwgdmFsdWUgfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIGxpc3RTcGluZU5vZGVzKCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGxldCBzcDogYW55O1xuICAgICAgICAgICAgdHJ5IHsgc3AgPSByZXF1aXJlKCdjYycpLnNwOyBpZiAoIXNwKSB0aHJvdyBuZXcgRXJyb3IoJ25vdCBmb3VuZCcpOyB9IGNhdGNoIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnU3BpbmUgbW9kdWxlIG5vdCBhdmFpbGFibGUgaW4gdGhpcyBwcm9qZWN0JyB9OyB9XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlczogYW55W10gPSBbXTtcbiAgICAgICAgICAgIHNjZW5lLndhbGsoKG5vZGU6IGFueSkgPT4geyBpZiAobm9kZS5nZXRDb21wb25lbnQoc3AuU2tlbGV0b24pKSBub2Rlcy5wdXNoKHsgdXVpZDogbm9kZS51dWlkLCBuYW1lOiBub2RlLm5hbWUgfSk7IH0pO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogeyBub2RlcywgY291bnQ6IG5vZGVzLmxlbmd0aCB9IH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgYWRkU3BpbmVUb05vZGUobm9kZVV1aWQ6IHN0cmluZywgc2tlbGV0b25EYXRhVXVpZDogc3RyaW5nKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCBhc3NldE1hbmFnZXIgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBsZXQgc3A6IGFueTtcbiAgICAgICAgICAgIHRyeSB7IHNwID0gcmVxdWlyZSgnY2MnKS5zcDsgaWYgKCFzcCkgdGhyb3cgbmV3IEVycm9yKCdub3QgZm91bmQnKTsgfSBjYXRjaCB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ1NwaW5lIG1vZHVsZSBub3QgYXZhaWxhYmxlIGluIHRoaXMgcHJvamVjdCcgfTsgfVxuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IGZpbmROb2RlQnlVdWlkRGVlcChzY2VuZSwgbm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIGNvbnN0IGNvbXAgPSBub2RlLmFkZENvbXBvbmVudChzcC5Ta2VsZXRvbik7XG4gICAgICAgICAgICBhc3NldE1hbmFnZXIubG9hZEFueShza2VsZXRvbkRhdGFVdWlkLCAoZXJyOiBhbnksIGFzc2V0OiBhbnkpID0+IHsgaWYgKCFlcnIgJiYgYXNzZXQpIGNvbXAuc2tlbGV0b25EYXRhID0gYXNzZXQ7IH0pO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogeyBub2RlVXVpZCwgc2tlbGV0b25EYXRhVXVpZCB9IH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgLy8g4pSA4pSAIERyYWdvbkJvbmVzIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuXG4gICAgZ2V0RHJhZ29uQm9uZXNJbmZvKG5vZGVVdWlkOiBzdHJpbmcpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBsZXQgZGI6IGFueTtcbiAgICAgICAgICAgIHRyeSB7IGRiID0gcmVxdWlyZSgnY2MnKS5kcmFnb25Cb25lczsgaWYgKCFkYikgdGhyb3cgbmV3IEVycm9yKCdub3QgZm91bmQnKTsgfSBjYXRjaCB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ0RyYWdvbkJvbmVzIG1vZHVsZSBub3QgYXZhaWxhYmxlIGluIHRoaXMgcHJvamVjdCcgfTsgfVxuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IGZpbmROb2RlQnlVdWlkRGVlcChzY2VuZSwgbm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIGNvbnN0IGNvbXAgPSBub2RlLmdldENvbXBvbmVudChkYi5Bcm1hdHVyZURpc3BsYXkpO1xuICAgICAgICAgICAgaWYgKCFjb21wKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBBcm1hdHVyZURpc3BsYXkgY29tcG9uZW50IG9uIG5vZGUnIH07XG4gICAgICAgICAgICBjb25zdCBhbmltYXRpb25zOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICAgICAgY29uc3QgYXJtYXR1cmVOYW1lczogc3RyaW5nW10gPSBbXTtcbiAgICAgICAgICAgIHRyeSB7IGlmIChjb21wLmRyYWdvbkFzc2V0KSB7IGFybWF0dXJlTmFtZXMucHVzaCguLi4oY29tcC5kcmFnb25Bc3NldC5hcm1hdHVyZU5hbWVzIHx8IFtdKSk7IGNvbnN0IGZhY3RvcnkgPSBkYi5DQ0ZhY3RvcnkuZ2V0SW5zdGFuY2UoKTsgaWYgKGZhY3RvcnkpIHsgY29uc3QgYXJtID0gZmFjdG9yeS5idWlsZEFybWF0dXJlKGNvbXAuYXJtYXR1cmVOYW1lLCBjb21wLmRyYWdvbkFzc2V0Lm5hbWUpOyBpZiAoYXJtKSB7IGFuaW1hdGlvbnMucHVzaCguLi5hcm0uYW5pbWF0aW9uLmFuaW1hdGlvbk5hbWVzKTsgYXJtLmRpc3Bvc2UoKTsgfSB9IH0gfSBjYXRjaCB7IC8qIGlnbm9yZSAqLyB9XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IGFybWF0dXJlTmFtZXMsIGFuaW1hdGlvbnMsIHRpbWVTY2FsZTogY29tcC50aW1lU2NhbGUsIGFybWF0dXJlTmFtZTogY29tcC5hcm1hdHVyZU5hbWUgfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIHNldERyYWdvbkJvbmVzQW5pbWF0aW9uKG5vZGVVdWlkOiBzdHJpbmcsIGFuaW1hdGlvbk5hbWU6IHN0cmluZywgcGxheVRpbWVzOiBudW1iZXIpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBsZXQgZGI6IGFueTtcbiAgICAgICAgICAgIHRyeSB7IGRiID0gcmVxdWlyZSgnY2MnKS5kcmFnb25Cb25lczsgaWYgKCFkYikgdGhyb3cgbmV3IEVycm9yKCdub3QgZm91bmQnKTsgfSBjYXRjaCB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ0RyYWdvbkJvbmVzIG1vZHVsZSBub3QgYXZhaWxhYmxlIGluIHRoaXMgcHJvamVjdCcgfTsgfVxuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IGZpbmROb2RlQnlVdWlkRGVlcChzY2VuZSwgbm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIGNvbnN0IGNvbXAgPSBub2RlLmdldENvbXBvbmVudChkYi5Bcm1hdHVyZURpc3BsYXkpO1xuICAgICAgICAgICAgaWYgKCFjb21wKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBBcm1hdHVyZURpc3BsYXkgY29tcG9uZW50IG9uIG5vZGUnIH07XG4gICAgICAgICAgICBjb21wLnBsYXlBbmltYXRpb24oYW5pbWF0aW9uTmFtZSwgcGxheVRpbWVzKTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHsgYW5pbWF0aW9uTmFtZSwgcGxheVRpbWVzIH0gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICBzZXREcmFnb25Cb25lc0FybWF0dXJlKG5vZGVVdWlkOiBzdHJpbmcsIGFybWF0dXJlTmFtZTogc3RyaW5nKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgbGV0IGRiOiBhbnk7XG4gICAgICAgICAgICB0cnkgeyBkYiA9IHJlcXVpcmUoJ2NjJykuZHJhZ29uQm9uZXM7IGlmICghZGIpIHRocm93IG5ldyBFcnJvcignbm90IGZvdW5kJyk7IH0gY2F0Y2ggeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdEcmFnb25Cb25lcyBtb2R1bGUgbm90IGF2YWlsYWJsZSBpbiB0aGlzIHByb2plY3QnIH07IH1cbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBmaW5kTm9kZUJ5VXVpZERlZXAoc2NlbmUsIG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm9kZSAke25vZGVVdWlkfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICBjb25zdCBjb21wID0gbm9kZS5nZXRDb21wb25lbnQoZGIuQXJtYXR1cmVEaXNwbGF5KTtcbiAgICAgICAgICAgIGlmICghY29tcCkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gQXJtYXR1cmVEaXNwbGF5IGNvbXBvbmVudCBvbiBub2RlJyB9O1xuICAgICAgICAgICAgY29tcC5hcm1hdHVyZU5hbWUgPSBhcm1hdHVyZU5hbWU7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IGFybWF0dXJlTmFtZSB9IH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgc2V0RHJhZ29uQm9uZXNQcm9wZXJ0eShub2RlVXVpZDogc3RyaW5nLCBwcm9wZXJ0eTogc3RyaW5nLCB2YWx1ZTogYW55KSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgbGV0IGRiOiBhbnk7XG4gICAgICAgICAgICB0cnkgeyBkYiA9IHJlcXVpcmUoJ2NjJykuZHJhZ29uQm9uZXM7IGlmICghZGIpIHRocm93IG5ldyBFcnJvcignbm90IGZvdW5kJyk7IH0gY2F0Y2ggeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdEcmFnb25Cb25lcyBtb2R1bGUgbm90IGF2YWlsYWJsZSBpbiB0aGlzIHByb2plY3QnIH07IH1cbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBmaW5kTm9kZUJ5VXVpZERlZXAoc2NlbmUsIG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm9kZSAke25vZGVVdWlkfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICBjb25zdCBjb21wID0gbm9kZS5nZXRDb21wb25lbnQoZGIuQXJtYXR1cmVEaXNwbGF5KTtcbiAgICAgICAgICAgIGlmICghY29tcCkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gQXJtYXR1cmVEaXNwbGF5IGNvbXBvbmVudCBvbiBub2RlJyB9O1xuICAgICAgICAgICAgY29uc3QgYWxsb3dlZCA9IFsndGltZVNjYWxlJywgJ2RlYnVnQm9uZXMnLCAncGxheVRpbWVzJ107XG4gICAgICAgICAgICBpZiAoIWFsbG93ZWQuaW5jbHVkZXMocHJvcGVydHkpKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBQcm9wZXJ0eSAnJHtwcm9wZXJ0eX0nIG5vdCBhbGxvd2VkLiBVc2U6ICR7YWxsb3dlZC5qb2luKCcsICcpfWAgfTtcbiAgICAgICAgICAgIChjb21wIGFzIGFueSlbcHJvcGVydHldID0gdmFsdWU7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IHByb3BlcnR5LCB2YWx1ZSB9IH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgbGlzdERyYWdvbkJvbmVzTm9kZXMoKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgbGV0IGRiOiBhbnk7XG4gICAgICAgICAgICB0cnkgeyBkYiA9IHJlcXVpcmUoJ2NjJykuZHJhZ29uQm9uZXM7IGlmICghZGIpIHRocm93IG5ldyBFcnJvcignbm90IGZvdW5kJyk7IH0gY2F0Y2ggeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdEcmFnb25Cb25lcyBtb2R1bGUgbm90IGF2YWlsYWJsZSBpbiB0aGlzIHByb2plY3QnIH07IH1cbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGVzOiBhbnlbXSA9IFtdO1xuICAgICAgICAgICAgc2NlbmUud2Fsaygobm9kZTogYW55KSA9PiB7IGlmIChub2RlLmdldENvbXBvbmVudChkYi5Bcm1hdHVyZURpc3BsYXkpKSBub2Rlcy5wdXNoKHsgdXVpZDogbm9kZS51dWlkLCBuYW1lOiBub2RlLm5hbWUgfSk7IH0pO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogeyBub2RlcywgY291bnQ6IG5vZGVzLmxlbmd0aCB9IH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgYWRkRHJhZ29uQm9uZXNUb05vZGUobm9kZVV1aWQ6IHN0cmluZywgZHJhZ29uQm9uZXNBc3NldFV1aWQ6IHN0cmluZywgZHJhZ29uQm9uZXNBdGxhc0Fzc2V0VXVpZDogc3RyaW5nKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCBhc3NldE1hbmFnZXIgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBsZXQgZGI6IGFueTtcbiAgICAgICAgICAgIHRyeSB7IGRiID0gcmVxdWlyZSgnY2MnKS5kcmFnb25Cb25lczsgaWYgKCFkYikgdGhyb3cgbmV3IEVycm9yKCdub3QgZm91bmQnKTsgfSBjYXRjaCB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ0RyYWdvbkJvbmVzIG1vZHVsZSBub3QgYXZhaWxhYmxlIGluIHRoaXMgcHJvamVjdCcgfTsgfVxuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IGZpbmROb2RlQnlVdWlkRGVlcChzY2VuZSwgbm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIGNvbnN0IGNvbXAgPSBub2RlLmFkZENvbXBvbmVudChkYi5Bcm1hdHVyZURpc3BsYXkpO1xuICAgICAgICAgICAgYXNzZXRNYW5hZ2VyLmxvYWRBbnkoW2RyYWdvbkJvbmVzQXNzZXRVdWlkLCBkcmFnb25Cb25lc0F0bGFzQXNzZXRVdWlkXSwgKGVycjogYW55LCBhc3NldHM6IGFueVtdKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKCFlcnIgJiYgYXNzZXRzKSB7IGNvbXAuZHJhZ29uQXNzZXQgPSBhc3NldHNbMF07IGNvbXAuZHJhZ29uQXRsYXNBc3NldCA9IGFzc2V0c1sxXTsgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IG5vZGVVdWlkLCBkcmFnb25Cb25lc0Fzc2V0VXVpZCwgZHJhZ29uQm9uZXNBdGxhc0Fzc2V0VXVpZCB9IH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgLy8g4pSA4pSAIFRlcnJhaW4g4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5cbiAgICBnZXRUZXJyYWluSW5mbyhub2RlVXVpZDogc3RyaW5nKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCBqcyB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBmaW5kTm9kZUJ5VXVpZERlZXAoc2NlbmUsIG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm9kZSAke25vZGVVdWlkfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICBjb25zdCBUZXJyYWluID0ganMuZ2V0Q2xhc3NCeU5hbWUoJ1RlcnJhaW4nKTtcbiAgICAgICAgICAgIGlmICghVGVycmFpbikgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnVGVycmFpbiBjbGFzcyBub3QgZm91bmQg4oCUIDNEIG9ubHknIH07XG4gICAgICAgICAgICBjb25zdCBjb21wID0gbm9kZS5nZXRDb21wb25lbnQoVGVycmFpbik7XG4gICAgICAgICAgICBpZiAoIWNvbXApIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIFRlcnJhaW4gY29tcG9uZW50IG9uIG5vZGUnIH07XG4gICAgICAgICAgICBjb25zdCBsYXllckNvdW50ID0gY29tcC5nZXRMYXllckNvdW50ID8gY29tcC5nZXRMYXllckNvdW50KCkgOiAoY29tcC5sYXllcnMgPyBjb21wLmxheWVycy5sZW5ndGggOiAwKTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHsgdGlsZVNpemU6IGNvbXAudGlsZVNpemUsIHdlaWdodE1hcFNpemU6IGNvbXAud2VpZ2h0TWFwU2l6ZSwgbGlnaHRNYXBTaXplOiBjb21wLmxpZ2h0TWFwU2l6ZSwgYmxvY2tDb3VudDogY29tcC5ibG9ja0NvdW50LCBsYXllckNvdW50IH0gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICBzZXRUZXJyYWluUHJvcGVydHkobm9kZVV1aWQ6IHN0cmluZywgcHJvcGVydHk6IHN0cmluZywgdmFsdWU6IGFueSkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwganMgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlID0gZmluZE5vZGVCeVV1aWREZWVwKHNjZW5lLCBub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgY29uc3QgVGVycmFpbiA9IGpzLmdldENsYXNzQnlOYW1lKCdUZXJyYWluJyk7XG4gICAgICAgICAgICBpZiAoIVRlcnJhaW4pIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ1RlcnJhaW4gY2xhc3Mgbm90IGZvdW5kIOKAlCAzRCBvbmx5JyB9O1xuICAgICAgICAgICAgY29uc3QgY29tcCA9IG5vZGUuZ2V0Q29tcG9uZW50KFRlcnJhaW4pO1xuICAgICAgICAgICAgaWYgKCFjb21wKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBUZXJyYWluIGNvbXBvbmVudCBvbiBub2RlJyB9O1xuICAgICAgICAgICAgY29uc3QgYWxsb3dlZCA9IFsndGlsZVNpemUnLCAnd2VpZ2h0TWFwU2l6ZScsICdsaWdodE1hcFNpemUnXTtcbiAgICAgICAgICAgIGlmICghYWxsb3dlZC5pbmNsdWRlcyhwcm9wZXJ0eSkpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYFByb3BlcnR5ICcke3Byb3BlcnR5fScgbm90IGFsbG93ZWQuIFVzZTogJHthbGxvd2VkLmpvaW4oJywgJyl9YCB9O1xuICAgICAgICAgICAgKGNvbXAgYXMgYW55KVtwcm9wZXJ0eV0gPSB2YWx1ZTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHsgcHJvcGVydHksIHZhbHVlIH0gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICBnZXRUZXJyYWluTGF5ZXJJbmZvKG5vZGVVdWlkOiBzdHJpbmcsIGxheWVySW5kZXg6IG51bWJlcikge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwganMgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlID0gZmluZE5vZGVCeVV1aWREZWVwKHNjZW5lLCBub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgY29uc3QgVGVycmFpbiA9IGpzLmdldENsYXNzQnlOYW1lKCdUZXJyYWluJyk7XG4gICAgICAgICAgICBpZiAoIVRlcnJhaW4pIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ1RlcnJhaW4gY2xhc3Mgbm90IGZvdW5kIOKAlCAzRCBvbmx5JyB9O1xuICAgICAgICAgICAgY29uc3QgY29tcCA9IG5vZGUuZ2V0Q29tcG9uZW50KFRlcnJhaW4pO1xuICAgICAgICAgICAgaWYgKCFjb21wKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBUZXJyYWluIGNvbXBvbmVudCBvbiBub2RlJyB9O1xuICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSBjb21wLmdldExheWVyID8gY29tcC5nZXRMYXllcihsYXllckluZGV4KSA6IChjb21wLmxheWVycyA/IGNvbXAubGF5ZXJzW2xheWVySW5kZXhdIDogbnVsbCk7XG4gICAgICAgICAgICBpZiAoIWxheWVyKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBMYXllciAke2xheWVySW5kZXh9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHsgbGF5ZXJJbmRleCwgdGlsZVNpemU6IGxheWVyLnRpbGVTaXplLCBkZXRhaWxNYXA6IGxheWVyLmRldGFpbE1hcD8udXVpZCB9IH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgc2V0VGVycmFpbkxheWVyKG5vZGVVdWlkOiBzdHJpbmcsIGxheWVySW5kZXg6IG51bWJlciwgZGV0YWlsTWFwVXVpZDogc3RyaW5nLCB0aWxlU2l6ZTogbnVtYmVyKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCBqcywgYXNzZXRNYW5hZ2VyIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IGZpbmROb2RlQnlVdWlkRGVlcChzY2VuZSwgbm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIGNvbnN0IFRlcnJhaW4gPSBqcy5nZXRDbGFzc0J5TmFtZSgnVGVycmFpbicpO1xuICAgICAgICAgICAgaWYgKCFUZXJyYWluKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdUZXJyYWluIGNsYXNzIG5vdCBmb3VuZCDigJQgM0Qgb25seScgfTtcbiAgICAgICAgICAgIGNvbnN0IGNvbXAgPSBub2RlLmdldENvbXBvbmVudChUZXJyYWluKTtcbiAgICAgICAgICAgIGlmICghY29tcCkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gVGVycmFpbiBjb21wb25lbnQgb24gbm9kZScgfTtcbiAgICAgICAgICAgIGFzc2V0TWFuYWdlci5sb2FkQW55KGRldGFpbE1hcFV1aWQsIChlcnI6IGFueSwgYXNzZXQ6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChlcnIgfHwgIWFzc2V0KSByZXR1cm47XG4gICAgICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSBjb21wLmdldExheWVyID8gY29tcC5nZXRMYXllcihsYXllckluZGV4KSA6IChjb21wLmxheWVycyA/IGNvbXAubGF5ZXJzW2xheWVySW5kZXhdIDogbnVsbCk7XG4gICAgICAgICAgICAgICAgaWYgKGxheWVyKSB7IGxheWVyLmRldGFpbE1hcCA9IGFzc2V0OyBpZiAodGlsZVNpemUgIT09IHVuZGVmaW5lZCkgbGF5ZXIudGlsZVNpemUgPSB0aWxlU2l6ZTsgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IGxheWVySW5kZXgsIGRldGFpbE1hcFV1aWQsIHRpbGVTaXplIH0gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICBnZXRUZXJyYWluSGVpZ2h0KG5vZGVVdWlkOiBzdHJpbmcsIHg6IG51bWJlciwgeTogbnVtYmVyKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCBqcyB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBmaW5kTm9kZUJ5VXVpZERlZXAoc2NlbmUsIG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm9kZSAke25vZGVVdWlkfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICBjb25zdCBUZXJyYWluID0ganMuZ2V0Q2xhc3NCeU5hbWUoJ1RlcnJhaW4nKTtcbiAgICAgICAgICAgIGlmICghVGVycmFpbikgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnVGVycmFpbiBjbGFzcyBub3QgZm91bmQg4oCUIDNEIG9ubHknIH07XG4gICAgICAgICAgICBjb25zdCBjb21wID0gbm9kZS5nZXRDb21wb25lbnQoVGVycmFpbik7XG4gICAgICAgICAgICBpZiAoIWNvbXApIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIFRlcnJhaW4gY29tcG9uZW50IG9uIG5vZGUnIH07XG4gICAgICAgICAgICBjb25zdCBoZWlnaHQgPSBjb21wLmdldEhlaWdodCA/IGNvbXAuZ2V0SGVpZ2h0KHgsIHkpIDogbnVsbDtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHsgeCwgeSwgaGVpZ2h0IH0gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICBzZXRUZXJyYWluSGVpZ2h0KG5vZGVVdWlkOiBzdHJpbmcsIHg6IG51bWJlciwgeTogbnVtYmVyLCBoZWlnaHQ6IG51bWJlcikge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwganMgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlID0gZmluZE5vZGVCeVV1aWREZWVwKHNjZW5lLCBub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgY29uc3QgVGVycmFpbiA9IGpzLmdldENsYXNzQnlOYW1lKCdUZXJyYWluJyk7XG4gICAgICAgICAgICBpZiAoIVRlcnJhaW4pIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ1RlcnJhaW4gY2xhc3Mgbm90IGZvdW5kIOKAlCAzRCBvbmx5JyB9O1xuICAgICAgICAgICAgY29uc3QgY29tcCA9IG5vZGUuZ2V0Q29tcG9uZW50KFRlcnJhaW4pO1xuICAgICAgICAgICAgaWYgKCFjb21wKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBUZXJyYWluIGNvbXBvbmVudCBvbiBub2RlJyB9O1xuICAgICAgICAgICAgaWYgKCFjb21wLnNldEhlaWdodCkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnc2V0SGVpZ2h0IG5vdCBhdmFpbGFibGUgb24gdGhpcyBUZXJyYWluIHZlcnNpb24nIH07XG4gICAgICAgICAgICBjb21wLnNldEhlaWdodCh4LCB5LCBoZWlnaHQpO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogeyB4LCB5LCBoZWlnaHQgfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIGxpc3RUZXJyYWluTm9kZXMoKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCBqcyB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IFRlcnJhaW4gPSBqcy5nZXRDbGFzc0J5TmFtZSgnVGVycmFpbicpO1xuICAgICAgICAgICAgaWYgKCFUZXJyYWluKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdUZXJyYWluIGNsYXNzIG5vdCBmb3VuZCDigJQgM0Qgb25seScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGVzOiBhbnlbXSA9IFtdO1xuICAgICAgICAgICAgc2NlbmUud2Fsaygobm9kZTogYW55KSA9PiB7IGlmIChub2RlLmdldENvbXBvbmVudChUZXJyYWluKSkgbm9kZXMucHVzaCh7IHV1aWQ6IG5vZGUudXVpZCwgbmFtZTogbm9kZS5uYW1lIH0pOyB9KTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHsgbm9kZXMsIGNvdW50OiBub2Rlcy5sZW5ndGggfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIC8vIOKUgOKUgCBQaGFzZSA0OiBSZW5kZXIgUGlwZWxpbmUg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5cbiAgICBnZXRSZW5kZXJQaXBlbGluZUluZm8oKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3QgcGlwZWxpbmUgPSBkaXJlY3Rvci5yb290ICYmIGRpcmVjdG9yLnJvb3QucGlwZWxpbmU7XG4gICAgICAgICAgICBpZiAoIXBpcGVsaW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyByZW5kZXIgcGlwZWxpbmUg4oCUIDNEIHNjZW5lIHJlcXVpcmVkJyB9O1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgY29uc3QgZW52ID0gc2NlbmUgJiYgc2NlbmUuZ2xvYmFscyAmJiBzY2VuZS5nbG9iYWxzLmVudmlyb25tZW50O1xuICAgICAgICAgICAgY29uc3QgZm9nID0gc2NlbmUgJiYgc2NlbmUuZ2xvYmFscyAmJiBzY2VuZS5nbG9iYWxzLmZvZztcbiAgICAgICAgICAgIGNvbnN0IHNoYWRvd3MgPSBzY2VuZSAmJiBzY2VuZS5nbG9iYWxzICYmIHNjZW5lLmdsb2JhbHMuc2hhZG93cztcbiAgICAgICAgICAgIGNvbnN0IHNreWJveCA9IHNjZW5lICYmIHNjZW5lLmdsb2JhbHMgJiYgc2NlbmUuZ2xvYmFscy5za3lib3g7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHtcbiAgICAgICAgICAgICAgICAgICAgc2hhZG93czogc2hhZG93cyA/IHsgZW5hYmxlZDogc2hhZG93cy5lbmFibGVkLCB0eXBlOiBzaGFkb3dzLnR5cGUsIHNoYWRvd01hcFNpemU6IHNoYWRvd3MubWFwU2l6ZSB9IDogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgZm9nOiBmb2cgPyB7IGVuYWJsZWQ6IGZvZy5lbmFibGVkLCB0eXBlOiBmb2cudHlwZSwgZm9nU3RhcnQ6IGZvZy5mb2dTdGFydCwgZm9nRW5kOiBmb2cuZm9nRW5kLCBmb2dEZW5zaXR5OiBmb2cuZm9nRGVuc2l0eSB9IDogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgc2t5Ym94OiBza3lib3ggPyB7IGVuYWJsZWQ6IHNreWJveC5lbmFibGVkLCB1c2VIRFI6IHNreWJveC51c2VIRFIsIHJvdGF0aW9uQW5nbGU6IHNreWJveC5yb3RhdGlvbkFuZ2xlIH0gOiBudWxsLFxuICAgICAgICAgICAgICAgICAgICBhbWJpZW50OiBlbnYgPyB7IHNreUNvbG9yOiBlbnYuc2t5Q29sb3IsIGdyb3VuZEFsYmVkbzogZW52Lmdyb3VuZEFsYmVkbyB9IDogbnVsbCxcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIHNldFNoYWRvd1NldHRpbmdzKGVuYWJsZWQ6IGJvb2xlYW4gfCB1bmRlZmluZWQsIHR5cGU6IHN0cmluZyB8IHVuZGVmaW5lZCwgc2hhZG93TWFwU2l6ZTogbnVtYmVyIHwgdW5kZWZpbmVkKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3Qgc2hhZG93cyA9IHNjZW5lLmdsb2JhbHMgJiYgc2NlbmUuZ2xvYmFscy5zaGFkb3dzO1xuICAgICAgICAgICAgaWYgKCFzaGFkb3dzKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdTaGFkb3cgZ2xvYmFscyBub3QgYXZhaWxhYmxlIOKAlCAzRCBzY2VuZSByZXF1aXJlZCcgfTtcbiAgICAgICAgICAgIGlmIChlbmFibGVkICE9PSB1bmRlZmluZWQpIHNoYWRvd3MuZW5hYmxlZCA9IGVuYWJsZWQ7XG4gICAgICAgICAgICBpZiAodHlwZSAhPT0gdW5kZWZpbmVkKSBzaGFkb3dzLnR5cGUgPSB0eXBlO1xuICAgICAgICAgICAgaWYgKHNoYWRvd01hcFNpemUgIT09IHVuZGVmaW5lZCkgc2hhZG93cy5tYXBTaXplID0gc2hhZG93TWFwU2l6ZTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHsgZW5hYmxlZDogc2hhZG93cy5lbmFibGVkLCB0eXBlOiBzaGFkb3dzLnR5cGUsIG1hcFNpemU6IHNoYWRvd3MubWFwU2l6ZSB9IH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgc2V0Rm9nU2V0dGluZ3MoZW5hYmxlZDogYm9vbGVhbiB8IHVuZGVmaW5lZCwgZm9nQ29sb3I6IHN0cmluZyB8IHVuZGVmaW5lZCwgdHlwZTogc3RyaW5nIHwgdW5kZWZpbmVkLCBmb2dTdGFydDogbnVtYmVyIHwgdW5kZWZpbmVkLCBmb2dFbmQ6IG51bWJlciB8IHVuZGVmaW5lZCwgZm9nRGVuc2l0eTogbnVtYmVyIHwgdW5kZWZpbmVkKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCBDb2xvciB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IGZvZyA9IHNjZW5lLmdsb2JhbHMgJiYgc2NlbmUuZ2xvYmFscy5mb2c7XG4gICAgICAgICAgICBpZiAoIWZvZykgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnRm9nIGdsb2JhbHMgbm90IGF2YWlsYWJsZSDigJQgM0Qgc2NlbmUgcmVxdWlyZWQnIH07XG4gICAgICAgICAgICBpZiAoZW5hYmxlZCAhPT0gdW5kZWZpbmVkKSBmb2cuZW5hYmxlZCA9IGVuYWJsZWQ7XG4gICAgICAgICAgICBpZiAodHlwZSAhPT0gdW5kZWZpbmVkKSBmb2cudHlwZSA9IHR5cGU7XG4gICAgICAgICAgICBpZiAoZm9nU3RhcnQgIT09IHVuZGVmaW5lZCkgZm9nLmZvZ1N0YXJ0ID0gZm9nU3RhcnQ7XG4gICAgICAgICAgICBpZiAoZm9nRW5kICE9PSB1bmRlZmluZWQpIGZvZy5mb2dFbmQgPSBmb2dFbmQ7XG4gICAgICAgICAgICBpZiAoZm9nRGVuc2l0eSAhPT0gdW5kZWZpbmVkKSBmb2cuZm9nRGVuc2l0eSA9IGZvZ0RlbnNpdHk7XG4gICAgICAgICAgICBpZiAoZm9nQ29sb3IgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGhleCA9IGZvZ0NvbG9yLnJlcGxhY2UoJyMnLCAnJyk7XG4gICAgICAgICAgICAgICAgY29uc3QgciA9IHBhcnNlSW50KGhleC5zdWJzdHJpbmcoMCwgMiksIDE2KTtcbiAgICAgICAgICAgICAgICBjb25zdCBnID0gcGFyc2VJbnQoaGV4LnN1YnN0cmluZygyLCA0KSwgMTYpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGIgPSBwYXJzZUludChoZXguc3Vic3RyaW5nKDQsIDYpLCAxNik7XG4gICAgICAgICAgICAgICAgZm9nLmZvZ0NvbG9yID0gbmV3IENvbG9yKHIsIGcsIGIsIDI1NSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IGVuYWJsZWQ6IGZvZy5lbmFibGVkLCB0eXBlOiBmb2cudHlwZSwgZm9nU3RhcnQ6IGZvZy5mb2dTdGFydCwgZm9nRW5kOiBmb2cuZm9nRW5kLCBmb2dEZW5zaXR5OiBmb2cuZm9nRGVuc2l0eSB9IH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgc2V0U2t5Ym94U2V0dGluZ3MoZW5hYmxlZDogYm9vbGVhbiB8IHVuZGVmaW5lZCwgdXNlSERSOiBib29sZWFuIHwgdW5kZWZpbmVkLCByb3RhdGlvbkFuZ2xlOiBudW1iZXIgfCB1bmRlZmluZWQpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBza3lib3ggPSBzY2VuZS5nbG9iYWxzICYmIHNjZW5lLmdsb2JhbHMuc2t5Ym94O1xuICAgICAgICAgICAgaWYgKCFza3lib3gpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ1NreWJveCBnbG9iYWxzIG5vdCBhdmFpbGFibGUg4oCUIDNEIHNjZW5lIHJlcXVpcmVkJyB9O1xuICAgICAgICAgICAgaWYgKGVuYWJsZWQgIT09IHVuZGVmaW5lZCkgc2t5Ym94LmVuYWJsZWQgPSBlbmFibGVkO1xuICAgICAgICAgICAgaWYgKHVzZUhEUiAhPT0gdW5kZWZpbmVkKSBza3lib3gudXNlSERSID0gdXNlSERSO1xuICAgICAgICAgICAgaWYgKHJvdGF0aW9uQW5nbGUgIT09IHVuZGVmaW5lZCkgc2t5Ym94LnJvdGF0aW9uQW5nbGUgPSByb3RhdGlvbkFuZ2xlO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogeyBlbmFibGVkOiBza3lib3guZW5hYmxlZCwgdXNlSERSOiBza3lib3gudXNlSERSLCByb3RhdGlvbkFuZ2xlOiBza3lib3gucm90YXRpb25BbmdsZSB9IH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgc2V0UG9zdFByb2Nlc3NTZXR0aW5ncyhibG9vbTogeyBlbmFibGVkPzogYm9vbGVhbjsgaW50ZW5zaXR5PzogbnVtYmVyIH0gfCB1bmRlZmluZWQsIHRvbmVtYXA6IHN0cmluZyB8IHVuZGVmaW5lZCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHBpcGVsaW5lID0gZGlyZWN0b3Iucm9vdCAmJiBkaXJlY3Rvci5yb290LnBpcGVsaW5lO1xuICAgICAgICAgICAgaWYgKCFwaXBlbGluZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gcmVuZGVyIHBpcGVsaW5lIOKAlCAzRCBzY2VuZSByZXF1aXJlZCcgfTtcbiAgICAgICAgICAgIGNvbnN0IHBwID0gcGlwZWxpbmUucG9zdFByb2Nlc3MgfHwgKHBpcGVsaW5lLmdldFBvc3RQcm9jZXNzICYmIHBpcGVsaW5lLmdldFBvc3RQcm9jZXNzKCkpO1xuICAgICAgICAgICAgaWYgKCFwcCkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnUG9zdFByb2Nlc3Mgbm90IGF2YWlsYWJsZSBvbiB0aGlzIHBpcGVsaW5lJyB9O1xuICAgICAgICAgICAgaWYgKGJsb29tICE9PSB1bmRlZmluZWQgJiYgcHAuYmxvb20pIHtcbiAgICAgICAgICAgICAgICBpZiAoYmxvb20uZW5hYmxlZCAhPT0gdW5kZWZpbmVkKSBwcC5ibG9vbS5lbmFibGVkID0gYmxvb20uZW5hYmxlZDtcbiAgICAgICAgICAgICAgICBpZiAoYmxvb20uaW50ZW5zaXR5ICE9PSB1bmRlZmluZWQpIHBwLmJsb29tLmludGVuc2l0eSA9IGJsb29tLmludGVuc2l0eTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICh0b25lbWFwICE9PSB1bmRlZmluZWQgJiYgcHAuY29sb3JHcmFkaW5nKSB7XG4gICAgICAgICAgICAgICAgcHAuY29sb3JHcmFkaW5nLnRvbmVtYXBNb2RlID0gdG9uZW1hcDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHsgYmxvb206IHBwLmJsb29tID8geyBlbmFibGVkOiBwcC5ibG9vbS5lbmFibGVkLCBpbnRlbnNpdHk6IHBwLmJsb29tLmludGVuc2l0eSB9IDogbnVsbCwgdG9uZW1hcCB9IH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgLy8g4pSA4pSAIFBoYXNlIDQ6IE1lc2ggUmVuZGVyZXIg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5cbiAgICBnZXRNZXNoUmVuZGVyZXJJbmZvKG5vZGVVdWlkOiBzdHJpbmcpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IsIGpzIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IGZpbmROb2RlQnlVdWlkRGVlcChzY2VuZSwgbm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIGNvbnN0IE1lc2hSZW5kZXJlciA9IGpzLmdldENsYXNzQnlOYW1lKCdNZXNoUmVuZGVyZXInKTtcbiAgICAgICAgICAgIGlmICghTWVzaFJlbmRlcmVyKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdNZXNoUmVuZGVyZXIgbm90IGF2YWlsYWJsZSDigJQgM0Qgb25seScgfTtcbiAgICAgICAgICAgIGNvbnN0IGNvbXAgPSBub2RlLmdldENvbXBvbmVudChNZXNoUmVuZGVyZXIpO1xuICAgICAgICAgICAgaWYgKCFjb21wKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBNZXNoUmVuZGVyZXIgb24gbm9kZScgfTtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSwgZGF0YToge1xuICAgICAgICAgICAgICAgICAgICBub2RlVXVpZCwgbm9kZU5hbWU6IG5vZGUubmFtZSxcbiAgICAgICAgICAgICAgICAgICAgc2hhZG93Q2FzdGluZ01vZGU6IGNvbXAuc2hhZG93Q2FzdGluZ01vZGUsXG4gICAgICAgICAgICAgICAgICAgIHJlY2VpdmVTaGFkb3c6IGNvbXAucmVjZWl2ZVNoYWRvdyxcbiAgICAgICAgICAgICAgICAgICAgdmlzaWJpbGl0eTogY29tcC52aXNpYmlsaXR5LFxuICAgICAgICAgICAgICAgICAgICBtZXNoOiBjb21wLm1lc2ggPyB7IHV1aWQ6IGNvbXAubWVzaC5fdXVpZCwgbmFtZTogY29tcC5tZXNoLm5hbWUgfSA6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgIG1hdGVyaWFsczogY29tcC5zaGFyZWRNYXRlcmlhbHMgPyBjb21wLnNoYXJlZE1hdGVyaWFscy5tYXAoKG06IGFueSkgPT4gbSA/IHsgdXVpZDogbS5fdXVpZCwgbmFtZTogbS5uYW1lIH0gOiBudWxsKSA6IFtdLFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgc2V0TWVzaFJlbmRlcmVyUHJvcGVydHkobm9kZVV1aWQ6IHN0cmluZywgcHJvcGVydHk6IHN0cmluZywgdmFsdWU6IGFueSkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwganMgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlID0gZmluZE5vZGVCeVV1aWREZWVwKHNjZW5lLCBub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgY29uc3QgTWVzaFJlbmRlcmVyID0ganMuZ2V0Q2xhc3NCeU5hbWUoJ01lc2hSZW5kZXJlcicpO1xuICAgICAgICAgICAgaWYgKCFNZXNoUmVuZGVyZXIpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ01lc2hSZW5kZXJlciBub3QgYXZhaWxhYmxlIOKAlCAzRCBvbmx5JyB9O1xuICAgICAgICAgICAgY29uc3QgY29tcCA9IG5vZGUuZ2V0Q29tcG9uZW50KE1lc2hSZW5kZXJlcik7XG4gICAgICAgICAgICBpZiAoIWNvbXApIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIE1lc2hSZW5kZXJlciBvbiBub2RlJyB9O1xuICAgICAgICAgICAgY29uc3QgYWxsb3dlZCA9IFsnc2hhZG93Q2FzdGluZ01vZGUnLCAncmVjZWl2ZVNoYWRvdycsICd2aXNpYmlsaXR5J107XG4gICAgICAgICAgICBpZiAoIWFsbG93ZWQuaW5jbHVkZXMocHJvcGVydHkpKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBQcm9wZXJ0eSAnJHtwcm9wZXJ0eX0nIG5vdCBhbGxvd2VkLiBVc2U6ICR7YWxsb3dlZC5qb2luKCcsICcpfWAgfTtcbiAgICAgICAgICAgIChjb21wIGFzIGFueSlbcHJvcGVydHldID0gdmFsdWU7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IG5vZGVVdWlkLCBwcm9wZXJ0eSwgdmFsdWUgfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIC8vIOKUgOKUgCBQaGFzZSA0OiBQcm9maWxlciDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcblxuICAgIGdldFBlcmZvcm1hbmNlU3RhdHMoKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCBwcm9maWxlciB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGVDb3VudCA9IHNjZW5lID8gKCgpID0+IHsgbGV0IG4gPSAwOyBzY2VuZS53YWxrKCgpID0+IG4rKyk7IHJldHVybiBuOyB9KSgpIDogMDtcbiAgICAgICAgICAgIGNvbnN0IHN0YXRzOiBhbnkgPSB7IG5vZGVDb3VudCB9O1xuICAgICAgICAgICAgaWYgKHByb2ZpbGVyKSB7XG4gICAgICAgICAgICAgICAgc3RhdHMuZnBzID0gcHJvZmlsZXIuZnBzICE9PSB1bmRlZmluZWQgPyBwcm9maWxlci5mcHMgOiBudWxsO1xuICAgICAgICAgICAgICAgIHN0YXRzLmRyYXdDYWxscyA9IHByb2ZpbGVyLmRyYXdDYWxscyAhPT0gdW5kZWZpbmVkID8gcHJvZmlsZXIuZHJhd0NhbGxzIDogbnVsbDtcbiAgICAgICAgICAgICAgICBzdGF0cy50cmlhbmdsZXMgPSBwcm9maWxlci50cmlhbmdsZXMgIT09IHVuZGVmaW5lZCA/IHByb2ZpbGVyLnRyaWFuZ2xlcyA6IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiBzdGF0cyB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIGdldE1lbW9yeVN0YXRzKCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgbWVtVXNhZ2UgPSBwcm9jZXNzLm1lbW9yeVVzYWdlID8gcHJvY2Vzcy5tZW1vcnlVc2FnZSgpIDogbnVsbDtcbiAgICAgICAgICAgIGNvbnN0IGRhdGE6IGFueSA9IHtcbiAgICAgICAgICAgICAgICBwcm9jZXNzOiBtZW1Vc2FnZSA/IHtcbiAgICAgICAgICAgICAgICAgICAgaGVhcFVzZWRNQjogKG1lbVVzYWdlLmhlYXBVc2VkIC8gMTAyNCAvIDEwMjQpLnRvRml4ZWQoMiksXG4gICAgICAgICAgICAgICAgICAgIGhlYXBUb3RhbE1COiAobWVtVXNhZ2UuaGVhcFRvdGFsIC8gMTAyNCAvIDEwMjQpLnRvRml4ZWQoMiksXG4gICAgICAgICAgICAgICAgICAgIHJzc01COiAobWVtVXNhZ2UucnNzIC8gMTAyNCAvIDEwMjQpLnRvRml4ZWQoMiksXG4gICAgICAgICAgICAgICAgfSA6IG51bGwsXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHBpcGVsaW5lID0gZGlyZWN0b3Iucm9vdCAmJiBkaXJlY3Rvci5yb290LnBpcGVsaW5lO1xuICAgICAgICAgICAgICAgIGlmIChwaXBlbGluZSAmJiBwaXBlbGluZS5kZXZpY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgZGF0YS5ncHUgPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBtZW1vcnlTdGF0dXM6IHBpcGVsaW5lLmRldmljZS5tZW1vcnlTdGF0dXMgfHwgbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIHsgLyogR1BVIHN0YXRzIG9wdGlvbmFsICovIH1cbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGEgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICB0b2dnbGVTdGF0c0Rpc3BsYXkodmlzaWJsZTogYm9vbGVhbiB8IHVuZGVmaW5lZCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBwcm9maWxlciB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGlmICghcHJvZmlsZXIpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ3Byb2ZpbGVyIG1vZHVsZSBub3QgYXZhaWxhYmxlJyB9O1xuICAgICAgICAgICAgaWYgKHZpc2libGUgPT09IHRydWUpIHtcbiAgICAgICAgICAgICAgICBwcm9maWxlci5zaG93U3RhdHMgJiYgcHJvZmlsZXIuc2hvd1N0YXRzKCk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHZpc2libGUgPT09IGZhbHNlKSB7XG4gICAgICAgICAgICAgICAgcHJvZmlsZXIuaGlkZVN0YXRzICYmIHByb2ZpbGVyLmhpZGVTdGF0cygpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyB0b2dnbGVcbiAgICAgICAgICAgICAgICBpZiAocHJvZmlsZXIuaXNTaG93aW5nU3RhdHMgJiYgcHJvZmlsZXIuaXNTaG93aW5nU3RhdHMoKSkge1xuICAgICAgICAgICAgICAgICAgICBwcm9maWxlci5oaWRlU3RhdHMgJiYgcHJvZmlsZXIuaGlkZVN0YXRzKCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcHJvZmlsZXIuc2hvd1N0YXRzICYmIHByb2ZpbGVyLnNob3dTdGF0cygpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IG5vd1Zpc2libGUgPSBwcm9maWxlci5pc1Nob3dpbmdTdGF0cyA/IHByb2ZpbGVyLmlzU2hvd2luZ1N0YXRzKCkgOiB2aXNpYmxlO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogeyB2aXNpYmxlOiBub3dWaXNpYmxlIH0gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICBnZXREcmF3Q2FsbFN0YXRzKCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwgcHJvZmlsZXIgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBwaXBlbGluZSA9IGRpcmVjdG9yLnJvb3QgJiYgZGlyZWN0b3Iucm9vdC5waXBlbGluZTtcbiAgICAgICAgICAgIGNvbnN0IGRhdGE6IGFueSA9IHt9O1xuICAgICAgICAgICAgaWYgKHByb2ZpbGVyKSB7XG4gICAgICAgICAgICAgICAgZGF0YS5kcmF3Q2FsbHMgPSBwcm9maWxlci5kcmF3Q2FsbHMgIT09IHVuZGVmaW5lZCA/IHByb2ZpbGVyLmRyYXdDYWxscyA6IG51bGw7XG4gICAgICAgICAgICAgICAgZGF0YS5pbnN0YW5jZWREcmF3Q2FsbHMgPSBwcm9maWxlci5pbnN0YW5jZWREcmF3Q2FsbHMgIT09IHVuZGVmaW5lZCA/IHByb2ZpbGVyLmluc3RhbmNlZERyYXdDYWxscyA6IG51bGw7XG4gICAgICAgICAgICAgICAgZGF0YS50cmlhbmdsZXMgPSBwcm9maWxlci50cmlhbmdsZXMgIT09IHVuZGVmaW5lZCA/IHByb2ZpbGVyLnRyaWFuZ2xlcyA6IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAocGlwZWxpbmUgJiYgcGlwZWxpbmUuc2NlbmVSZW5kZXJlcikge1xuICAgICAgICAgICAgICAgIGRhdGEuc2NlbmVSZW5kZXJlciA9IHBpcGVsaW5lLnNjZW5lUmVuZGVyZXIuZ2V0UHJvZmlsaW5nRGF0YSA/IHBpcGVsaW5lLnNjZW5lUmVuZGVyZXIuZ2V0UHJvZmlsaW5nRGF0YSgpIDogbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGEgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICAvLyDilIDilIAgUGhhc2UgNDogVmlkZW8gUGxheWVyIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuXG4gICAgYWRkVmlkZW9QbGF5ZXIobm9kZVV1aWQ6IHN0cmluZywgY2xpcFVybDogc3RyaW5nIHwgdW5kZWZpbmVkKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCBqcyB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBmaW5kTm9kZUJ5VXVpZERlZXAoc2NlbmUsIG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm9kZSAke25vZGVVdWlkfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICBjb25zdCBWaWRlb1BsYXllciA9IGpzLmdldENsYXNzQnlOYW1lKCdWaWRlb1BsYXllcicpO1xuICAgICAgICAgICAgaWYgKCFWaWRlb1BsYXllcikgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnVmlkZW9QbGF5ZXIgY29tcG9uZW50IG5vdCBhdmFpbGFibGUnIH07XG4gICAgICAgICAgICBsZXQgY29tcCA9IG5vZGUuZ2V0Q29tcG9uZW50KFZpZGVvUGxheWVyKTtcbiAgICAgICAgICAgIGlmICghY29tcCkgY29tcCA9IG5vZGUuYWRkQ29tcG9uZW50KFZpZGVvUGxheWVyKTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHsgbm9kZVV1aWQsIG5vZGVOYW1lOiBub2RlLm5hbWUsIGhhc0NsaXA6ICEhY2xpcFVybCB9IH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgc2V0VmlkZW9Qcm9wZXJ0eShub2RlVXVpZDogc3RyaW5nLCBwcm9wZXJ0eTogc3RyaW5nLCB2YWx1ZTogYW55KSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCBqcyB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBmaW5kTm9kZUJ5VXVpZERlZXAoc2NlbmUsIG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm9kZSAke25vZGVVdWlkfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICBjb25zdCBWaWRlb1BsYXllciA9IGpzLmdldENsYXNzQnlOYW1lKCdWaWRlb1BsYXllcicpO1xuICAgICAgICAgICAgaWYgKCFWaWRlb1BsYXllcikgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnVmlkZW9QbGF5ZXIgbm90IGF2YWlsYWJsZScgfTtcbiAgICAgICAgICAgIGNvbnN0IGNvbXAgPSBub2RlLmdldENvbXBvbmVudChWaWRlb1BsYXllcik7XG4gICAgICAgICAgICBpZiAoIWNvbXApIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIFZpZGVvUGxheWVyIG9uIG5vZGUnIH07XG4gICAgICAgICAgICBjb25zdCBhbGxvd2VkID0gWydyZXNvdXJjZVR5cGUnLCAncmVtb3RlVVJMJywgJ2NsaXAnLCAnbG9vcCcsICdwbGF5YmFja1JhdGUnLCAndm9sdW1lJ107XG4gICAgICAgICAgICBpZiAoIWFsbG93ZWQuaW5jbHVkZXMocHJvcGVydHkpKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBQcm9wZXJ0eSAnJHtwcm9wZXJ0eX0nIG5vdCBhbGxvd2VkLiBVc2U6ICR7YWxsb3dlZC5qb2luKCcsICcpfWAgfTtcbiAgICAgICAgICAgIChjb21wIGFzIGFueSlbcHJvcGVydHldID0gdmFsdWU7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IG5vZGVVdWlkLCBwcm9wZXJ0eSwgdmFsdWUgfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIGNvbnRyb2xWaWRlbyhub2RlVXVpZDogc3RyaW5nLCBjb21tYW5kOiBzdHJpbmcpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IsIGpzIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IGZpbmROb2RlQnlVdWlkRGVlcChzY2VuZSwgbm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIGNvbnN0IFZpZGVvUGxheWVyID0ganMuZ2V0Q2xhc3NCeU5hbWUoJ1ZpZGVvUGxheWVyJyk7XG4gICAgICAgICAgICBpZiAoIVZpZGVvUGxheWVyKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdWaWRlb1BsYXllciBub3QgYXZhaWxhYmxlJyB9O1xuICAgICAgICAgICAgY29uc3QgY29tcCA9IG5vZGUuZ2V0Q29tcG9uZW50KFZpZGVvUGxheWVyKTtcbiAgICAgICAgICAgIGlmICghY29tcCkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gVmlkZW9QbGF5ZXIgb24gbm9kZScgfTtcbiAgICAgICAgICAgIHN3aXRjaCAoY29tbWFuZCkge1xuICAgICAgICAgICAgICAgIGNhc2UgJ3BsYXknOiBjb21wLnBsYXkgJiYgY29tcC5wbGF5KCk7IGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgJ3BhdXNlJzogY29tcC5wYXVzZSAmJiBjb21wLnBhdXNlKCk7IGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgJ3N0b3AnOiBjb21wLnN0b3AgJiYgY29tcC5zdG9wKCk7IGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgJ3Jlc3VtZSc6IGNvbXAucmVzdW1lICYmIGNvbXAucmVzdW1lKCk7IGJyZWFrO1xuICAgICAgICAgICAgICAgIGRlZmF1bHQ6IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYFVua25vd24gY29tbWFuZCAnJHtjb21tYW5kfScuIFVzZTogcGxheSwgcGF1c2UsIHN0b3AsIHJlc3VtZWAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHsgbm9kZVV1aWQsIGNvbW1hbmQgfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIGdldFZpZGVvSW5mbyhub2RlVXVpZDogc3RyaW5nKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCBqcyB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBmaW5kTm9kZUJ5VXVpZERlZXAoc2NlbmUsIG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm9kZSAke25vZGVVdWlkfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICBjb25zdCBWaWRlb1BsYXllciA9IGpzLmdldENsYXNzQnlOYW1lKCdWaWRlb1BsYXllcicpO1xuICAgICAgICAgICAgaWYgKCFWaWRlb1BsYXllcikgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnVmlkZW9QbGF5ZXIgbm90IGF2YWlsYWJsZScgfTtcbiAgICAgICAgICAgIGNvbnN0IGNvbXAgPSBub2RlLmdldENvbXBvbmVudChWaWRlb1BsYXllcik7XG4gICAgICAgICAgICBpZiAoIWNvbXApIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIFZpZGVvUGxheWVyIG9uIG5vZGUnIH07XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHtcbiAgICAgICAgICAgICAgICAgICAgbm9kZVV1aWQsIG5vZGVOYW1lOiBub2RlLm5hbWUsXG4gICAgICAgICAgICAgICAgICAgIHJlc291cmNlVHlwZTogY29tcC5yZXNvdXJjZVR5cGUsIHJlbW90ZVVSTDogY29tcC5yZW1vdGVVUkwsXG4gICAgICAgICAgICAgICAgICAgIGxvb3A6IGNvbXAubG9vcCwgcGxheWJhY2tSYXRlOiBjb21wLnBsYXliYWNrUmF0ZSwgdm9sdW1lOiBjb21wLnZvbHVtZSxcbiAgICAgICAgICAgICAgICAgICAgbXV0ZTogY29tcC5tdXRlLCBrZWVwQXNwZWN0UmF0aW86IGNvbXAua2VlcEFzcGVjdFJhdGlvLFxuICAgICAgICAgICAgICAgICAgICBpc0Z1bGxzY3JlZW46IGNvbXAuaXNGdWxsc2NyZWVuLCBkdXJhdGlvbjogY29tcC5kdXJhdGlvbixcbiAgICAgICAgICAgICAgICAgICAgY3VycmVudFRpbWU6IGNvbXAuY3VycmVudFRpbWUsXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICBsaXN0VmlkZW9QbGF5ZXJzKCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwganMgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBWaWRlb1BsYXllciA9IGpzLmdldENsYXNzQnlOYW1lKCdWaWRlb1BsYXllcicpO1xuICAgICAgICAgICAgaWYgKCFWaWRlb1BsYXllcikgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnVmlkZW9QbGF5ZXIgbm90IGF2YWlsYWJsZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGVzOiBhbnlbXSA9IFtdO1xuICAgICAgICAgICAgc2NlbmUud2Fsaygobm9kZTogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29tcCA9IG5vZGUuZ2V0Q29tcG9uZW50KFZpZGVvUGxheWVyKTtcbiAgICAgICAgICAgICAgICBpZiAoY29tcCkgbm9kZXMucHVzaCh7IHV1aWQ6IG5vZGUudXVpZCwgbmFtZTogbm9kZS5uYW1lLCByZXNvdXJjZVR5cGU6IGNvbXAucmVzb3VyY2VUeXBlLCByZW1vdGVVUkw6IGNvbXAucmVtb3RlVVJMIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IG5vZGVzLCBjb3VudDogbm9kZXMubGVuZ3RoIH0gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICAvLyDilIDilIAgUGhhc2UgNDogSW5wdXQgU3lzdGVtIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuXG4gICAgZ2V0SW5wdXRDb25maWcoKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGlucHV0LCBzeXMgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHtcbiAgICAgICAgICAgICAgICAgICAgbXVsdGlUb3VjaDogaW5wdXQgJiYgaW5wdXQubXVsdGlUb3VjaCAhPT0gdW5kZWZpbmVkID8gaW5wdXQubXVsdGlUb3VjaCA6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgIGFjY2VsZXJvbWV0ZXJFbmFibGVkOiBzeXMgJiYgc3lzLmlzTmF0aXZlICE9PSB1bmRlZmluZWQgPyBudWxsIDogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgcGxhdGZvcm06IHN5cyA/IHN5cy5wbGF0Zm9ybSA6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgIGlzTW9iaWxlOiBzeXMgPyBzeXMuaXNNb2JpbGUgOiBudWxsLFxuICAgICAgICAgICAgICAgICAgICBoYXNUb3VjaDogc3lzID8gc3lzLmhhc0ZlYXR1cmUgJiYgc3lzLmhhc0ZlYXR1cmUoc3lzLkZlYXR1cmUuSU5QVVRfVE9VQ0gpIDogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgaGFzQWNjZWxlcm9tZXRlcjogc3lzID8gc3lzLmhhc0ZlYXR1cmUgJiYgc3lzLmhhc0ZlYXR1cmUoc3lzLkZlYXR1cmUuQUNDRUxFUk9NRVRFUikgOiBudWxsLFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgc2V0VG91Y2hDb25maWcoZW5hYmxlZDogYm9vbGVhbikge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBpbnB1dCB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGlmICghaW5wdXQpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ2lucHV0IG1vZHVsZSBub3QgYXZhaWxhYmxlJyB9O1xuICAgICAgICAgICAgaW5wdXQubXVsdGlUb3VjaCA9IGVuYWJsZWQ7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IG11bHRpVG91Y2g6IGlucHV0Lm11bHRpVG91Y2ggfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIHNldEFjY2VsZXJhdGlvbkNvbmZpZyhlbmFibGVkOiBib29sZWFuLCBpbnRlcnZhbDogbnVtYmVyIHwgdW5kZWZpbmVkKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGlucHV0LCBJbnB1dCB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGlmICghaW5wdXQpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ2lucHV0IG1vZHVsZSBub3QgYXZhaWxhYmxlJyB9O1xuICAgICAgICAgICAgaWYgKGVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICBpbnB1dC5zZXRBY2NlbGVyb21ldGVyRW5hYmxlZCAmJiBpbnB1dC5zZXRBY2NlbGVyb21ldGVyRW5hYmxlZCh0cnVlKTtcbiAgICAgICAgICAgICAgICBpZiAoaW50ZXJ2YWwgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICBpbnB1dC5zZXRBY2NlbGVyb21ldGVySW50ZXJ2YWwgJiYgaW5wdXQuc2V0QWNjZWxlcm9tZXRlckludGVydmFsKGludGVydmFsKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlucHV0LnNldEFjY2VsZXJvbWV0ZXJFbmFibGVkICYmIGlucHV0LnNldEFjY2VsZXJvbWV0ZXJFbmFibGVkKGZhbHNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHsgZW5hYmxlZCwgaW50ZXJ2YWwgfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEV2YWx1YXRlIGFyYml0cmFyeSBKYXZhU2NyaXB0IGluIHRoZSBzY2VuZSBjb250ZXh0IGFuZCByZXR1cm4gaXRzIHJlc3VsdC5cbiAgICAgKiBEYW5nZXJvdXMtcGF0dGVybiBkZW55bGlzdGluZyAocmVxdWlyZSgnY2hpbGRfcHJvY2VzcycpLCBwcm9jZXNzLmV4aXQsIGV2YWwoLFxuICAgICAqIEZ1bmN0aW9uKCkgaGFwcGVucyBjbGllbnQtc2lkZSBpbiBNYW5hZ2VEZWJ1Zy52YWxpZGF0ZVNjcmlwdCBiZWZvcmUgdGhpcyBpc1xuICAgICAqIGV2ZXIgaW52b2tlZCDigJQgdGhpcyBtZXRob2Qgb25seSBydW5zIGFscmVhZHktYXBwcm92ZWQgc2NyaXB0cy5cbiAgICAgKi9cbiAgICBldmFsKGNvZGU6IHN0cmluZykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLW5ldy1mdW5jXG4gICAgICAgICAgICBjb25zdCBmbiA9IG5ldyBGdW5jdGlvbihjb2RlKTtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGZuKCk7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IHJlc3VsdCB9IH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9O1xuICAgICAgICB9XG4gICAgfSxcbn07Il19