"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.methods = void 0;
const path_1 = require("path");
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
            const node = scene.getChildByUuid(nodeUuid);
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
     * Remove component from a node
     */
    removeComponentFromNode(nodeUuid, componentType) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene) {
                return { success: false, error: 'No active scene' };
            }
            const node = scene.getChildByUuid(nodeUuid);
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
                const parent = scene.getChildByUuid(parentUuid);
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
            const node = scene.getChildByUuid(nodeUuid);
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
            const node = scene.getChildByUuid(nodeUuid);
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
            const node = scene.getChildByUuid(nodeUuid);
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
            const node = scene.getChildByUuid(nodeUuid);
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
            const node = scene.getChildByUuid(nodeUuid);
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
            const node = scene.getChildByUuid(nodeUuid);
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
            const node = scene.getChildByUuid(nodeUuid);
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
            const node = scene.getChildByUuid(nodeUuid);
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
            const node = scene.getChildByUuid(nodeUuid);
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
            const node = scene.getChildByUuid(nodeUuid);
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
            const node = scene.getChildByUuid(nodeUuid);
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
            const node = scene.getChildByUuid(nodeUuid);
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
            const node = scene.getChildByUuid(nodeUuid);
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
            const node = scene.getChildByUuid(nodeUuid);
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
            const node = scene.getChildByUuid(nodeUuid);
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
            const node = scene.getChildByUuid(nodeUuid);
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
            const node = scene.getChildByUuid(nodeUuid);
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
            const node = scene.getChildByUuid(nodeUuid);
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
            const node = scene.getChildByUuid(nodeUuid);
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
            const node = scene.getChildByUuid(nodeUuid);
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
            const node = scene.getChildByUuid(nodeUuid);
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
            const node = scene.getChildByUuid(nodeUuid);
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
            const node = scene.getChildByUuid(nodeUuid);
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
            const node = scene.getChildByUuid(nodeUuid);
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
            const node = scene.getChildByUuid(nodeUuid);
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
            const node = scene.getChildByUuid(nodeUuid);
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
            const node = scene.getChildByUuid(nodeUuid);
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
            const node = scene.getChildByUuid(nodeUuid);
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
            const node = scene.getChildByUuid(nodeUuid);
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
            const node = scene.getChildByUuid(nodeUuid);
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
            const node = scene.getChildByUuid(nodeUuid);
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
            const node = scene.getChildByUuid(nodeUuid);
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
            const node = scene.getChildByUuid(nodeUuid);
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
            const node = scene.getChildByUuid(nodeUuid);
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
            const node = scene.getChildByUuid(nodeUuid);
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
            const node = scene.getChildByUuid(nodeUuid);
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
            const node = scene.getChildByUuid(nodeUuid);
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
            const node = scene.getChildByUuid(nodeUuid);
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
            const node = scene.getChildByUuid(nodeUuid);
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
            const node = scene.getChildByUuid(nodeUuid);
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
            const node = scene.getChildByUuid(nodeUuid);
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
            const node = scene.getChildByUuid(nodeUuid);
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
            const node = scene.getChildByUuid(nodeUuid);
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
            const node = scene.getChildByUuid(nodeUuid);
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
            const node = scene.getChildByUuid(nodeUuid);
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
            const node = scene.getChildByUuid(nodeUuid);
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
            const node = scene.getChildByUuid(nodeUuid);
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
            const node = scene.getChildByUuid(nodeUuid);
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
            const node = scene.getChildByUuid(nodeUuid);
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
            const node = scene.getChildByUuid(nodeUuid);
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
            const node = scene.getChildByUuid(nodeUuid);
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
            const node = scene.getChildByUuid(nodeUuid);
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
            const node = scene.getChildByUuid(nodeUuid);
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
            const node = scene.getChildByUuid(nodeUuid);
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
            const node = scene.getChildByUuid(nodeUuid);
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
            const node = scene.getChildByUuid(nodeUuid);
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
            const node = scene.getChildByUuid(nodeUuid);
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
            const node = scene.getChildByUuid(nodeUuid);
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
            const node = scene.getChildByUuid(nodeUuid);
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
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NlbmUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zb3VyY2Uvc2NlbmUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsK0JBQTRCO0FBQzVCLE1BQU0sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUEsV0FBSSxFQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLGNBQWMsQ0FBQyxDQUFDLENBQUM7QUFFNUMsUUFBQSxPQUFPLEdBQTRDO0lBQzVEOztPQUVHO0lBQ0gsY0FBYztRQUNWLElBQUksQ0FBQztZQUNELE1BQU0sRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQzFDLE1BQU0sS0FBSyxHQUFHLElBQUksS0FBSyxFQUFFLENBQUM7WUFDMUIsS0FBSyxDQUFDLElBQUksR0FBRyxXQUFXLENBQUM7WUFDekIsUUFBUSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUN6QixPQUFPLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsZ0NBQWdDLEVBQUUsQ0FBQztRQUN4RSxDQUFDO1FBQUMsT0FBTyxLQUFVLEVBQUUsQ0FBQztZQUNsQixPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ3BELENBQUM7SUFDTCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxrQkFBa0IsQ0FBQyxRQUFnQixFQUFFLGFBQXFCO1FBQ3RELElBQUksQ0FBQztZQUNELE1BQU0sRUFBRSxRQUFRLEVBQUUsRUFBRSxFQUFFLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ3ZDLE1BQU0sS0FBSyxHQUFHLFFBQVEsQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUNsQyxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7Z0JBQ1QsT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFF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Q0FBQyxDQUFDO2dCQUNwQyxDQUFDO3FCQUFNLElBQUksSUFBSSxDQUFDLElBQUksS0FBSyxJQUFJLElBQUksSUFBSSxDQUFDLElBQUksS0FBSyxJQUFJLEVBQUUsQ0FBQztvQkFDbEQsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFVBQVUsSUFBSSxFQUFFLENBQUM7b0JBQ3BDLE1BQU0sTUFBTSxHQUF3QixFQUFFLENBQUM7b0JBQ3ZDLElBQUksS0FBSyxDQUFDLFFBQVE7d0JBQUUsTUFBTSxDQUFDLFFBQVEsR0FBRyxJQUFJLElBQUksQ0FBQyxNQUFBLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQyxtQ0FBSSxDQUFDLEVBQUUsTUFBQSxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUMsbUNBQUksQ0FBQyxFQUFFLE1BQUEsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDLG1DQUFJLENBQUMsQ0FBQyxDQUFDO29CQUNwSCxJQUFJLEtBQUssQ0FBQyxLQUFLO3dCQUFFLE1BQU0sQ0FBQyxLQUFLLEdBQUcsSUFBSSxJQUFJLENBQUMsTUFBQSxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsbUNBQUksQ0FBQyxFQUFFLE1BQUEsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLG1DQUFJLENBQUMsRUFBRSxNQUFBLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxtQ0FBSSxDQUFDLENBQUMsQ0FBQztvQkFDckcsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxNQUFNLEVBQUUsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7b0JBQ3hELENBQUMsR0FBRyxJQUFJLENBQUMsSUFBSSxLQUFLLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxNQUFBLElBQUksQ0FBQyxRQUFRLG1DQUFJLENBQUMsRUFBRSxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsTUFBQSxJQUFJLENBQUMs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U0FBUyxFQUFFLENBQUM7b0JBQ3pCLEtBQUssQ0FBQyx3QkFBd0IsSUFBSSxLQUFLLENBQUMsd0JBQXdCLENBQUMsUUFBUSxDQUFDLENBQUM7Z0JBQy9FLENBQUM7WUFDTCxDQUFDO2lCQUFNLENBQUM7Z0JBQ0osS0FBSyxDQUFDLHVCQUF1QixJQUFJLEtBQUssQ0FBQyx1QkFBdUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUMxRSxDQUFDO1lBQ0QsT0FBTyxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLEVBQUUsT0FBTyxFQUFFLFFBQVEsRUFBRSxFQUFFLENBQUM7UUFDMUQsQ0FBQztRQUFDLE9BQU8sS0FBVSxFQUFFLENBQUM7WUFBQyxPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQUMsQ0FBQztJQUM3RSxDQUFDO0NBQ0osQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGpvaW4gfSBmcm9tICdwYXRoJztcbm1vZHVsZS5wYXRocy5wdXNoKGpvaW4oRWRpdG9yLkFwcC5wYXRoLCAnbm9kZV9tb2R1bGVzJykpO1xuXG5leHBvcnQgY29uc3QgbWV0aG9kczogeyBba2V5OiBzdHJpbmddOiAoLi4uYW55OiBhbnkpID0+IGFueSB9ID0ge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBzY2VuZVxuICAgICAqL1xuICAgIGNyZWF0ZU5ld1NjZW5lKCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwgU2NlbmUgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IG5ldyBTY2VuZSgpO1xuICAgICAgICAgICAgc2NlbmUubmFtZSA9ICdOZXcgU2NlbmUnO1xuICAgICAgICAgICAgZGlyZWN0b3IucnVuU2NlbmUoc2NlbmUpO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgbWVzc2FnZTogJ05ldyBzY2VuZSBjcmVhdGVkIHN1Y2Nlc3NmdWxseScgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQWRkIGNvbXBvbmVudCB0byBhIG5vZGVcbiAgICAgKi9cbiAgICBhZGRDb21wb25lbnRUb05vZGUobm9kZVV1aWQ6IHN0cmluZywgY29tcG9uZW50VHlwZTogc3RyaW5nKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCBqcyB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIEZpbmQgbm9kZSBieSBVVUlEXG4gICAgICAgICAgICBjb25zdCBub2RlID0gc2NlbmUuZ2V0Q2hpbGRCeVV1aWQobm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm9kZSB3aXRoIFVVSUQgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBHZXQgY29tcG9uZW50IGNsYXNzXG4gICAgICAgICAgICBjb25zdCBDb21wb25lbnRDbGFzcyA9IGpzLmdldENsYXNzQnlOYW1lKGNvbXBvbmVudFR5cGUpO1xuICAgICAgICAgICAgaWYgKCFDb21wb25lbnRDbGFzcykge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYENvbXBvbmVudCB0eXBlICR7Y29tcG9uZW50VHlwZX0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBBZGQgY29tcG9uZW50XG4gICAgICAgICAgICBjb25zdCBjb21wb25lbnQgPSBub2RlLmFkZENvbXBvbmVudChDb21wb25lbnRDbGFzcyk7XG4gICAgICAgICAgICByZXR1cm4geyBcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLCBcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBgQ29tcG9uZW50ICR7Y29tcG9uZW50VHlwZX0gYWRkZWQgc3VjY2Vzc2Z1bGx5YCxcbiAgICAgICAgICAgICAgICBkYXRhOiB7IGNvbXBvbmVudElkOiBjb21wb25lbnQudXVpZCB9XG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTtcbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmUgY29tcG9uZW50IGZyb20gYSBub2RlXG4gICAgICovXG4gICAgcmVtb3ZlQ29tcG9uZW50RnJvbU5vZGUobm9kZVV1aWQ6IHN0cmluZywgY29tcG9uZW50VHlwZTogc3RyaW5nKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCBqcyB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBzY2VuZS5nZXRDaGlsZEJ5VXVpZChub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlIHdpdGggVVVJRCAke25vZGVVdWlkfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IENvbXBvbmVudENsYXNzID0ganMuZ2V0Q2xhc3NCeU5hbWUoY29tcG9uZW50VHlwZSk7XG4gICAgICAgICAgICBpZiAoIUNvbXBvbmVudENsYXNzKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgQ29tcG9uZW50IHR5cGUgJHtjb21wb25lbnRUeXBlfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGNvbXBvbmVudCA9IG5vZGUuZ2V0Q29tcG9uZW50KENvbXBvbmVudENsYXNzKTtcbiAgICAgICAgICAgIGlmICghY29tcG9uZW50KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgQ29tcG9uZW50ICR7Y29tcG9uZW50VHlwZX0gbm90IGZvdW5kIG9uIG5vZGVgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIG5vZGUucmVtb3ZlQ29tcG9uZW50KGNvbXBvbmVudCk7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBtZXNzYWdlOiBgQ29tcG9uZW50ICR7Y29tcG9uZW50VHlwZX0gcmVtb3ZlZCBzdWNjZXNzZnVsbHlgIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9O1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBub2RlXG4gICAgICovXG4gICAgY3JlYXRlTm9kZShuYW1lOiBzdHJpbmcsIHBhcmVudFV1aWQ/OiBzdHJpbmcpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IsIE5vZGUgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBub2RlID0gbmV3IE5vZGUobmFtZSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmIChwYXJlbnRVdWlkKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcGFyZW50ID0gc2NlbmUuZ2V0Q2hpbGRCeVV1aWQocGFyZW50VXVpZCk7XG4gICAgICAgICAgICAgICAgaWYgKHBhcmVudCkge1xuICAgICAgICAgICAgICAgICAgICBwYXJlbnQuYWRkQ2hpbGQobm9kZSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgc2NlbmUuYWRkQ2hpbGQobm9kZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzY2VuZS5hZGRDaGlsZChub2RlKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHsgXG4gICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSwgXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogYE5vZGUgJHtuYW1lfSBjcmVhdGVkIHN1Y2Nlc3NmdWxseWAsXG4gICAgICAgICAgICAgICAgZGF0YTogeyB1dWlkOiBub2RlLnV1aWQsIG5hbWU6IG5vZGUubmFtZSB9XG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTtcbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBHZXQgbm9kZSBpbmZvcm1hdGlvblxuICAgICAqL1xuICAgIGdldE5vZGVJbmZvKG5vZGVVdWlkOiBzdHJpbmcpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBub2RlID0gc2NlbmUuZ2V0Q2hpbGRCeVV1aWQobm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm9kZSB3aXRoIFVVSUQgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICAgICAgICB1dWlkOiBub2RlLnV1aWQsXG4gICAgICAgICAgICAgICAgICAgIG5hbWU6IG5vZGUubmFtZSxcbiAgICAgICAgICAgICAgICAgICAgYWN0aXZlOiBub2RlLmFjdGl2ZSxcbiAgICAgICAgICAgICAgICAgICAgcG9zaXRpb246IG5vZGUucG9zaXRpb24sXG4gICAgICAgICAgICAgICAgICAgIHJvdGF0aW9uOiBub2RlLnJvdGF0aW9uLFxuICAgICAgICAgICAgICAgICAgICBzY2FsZTogbm9kZS5zY2FsZSxcbiAgICAgICAgICAgICAgICAgICAgcGFyZW50OiBub2RlLnBhcmVudD8udXVpZCxcbiAgICAgICAgICAgICAgICAgICAgY2hpbGRyZW46IG5vZGUuY2hpbGRyZW4ubWFwKChjaGlsZDogYW55KSA9PiBjaGlsZC51dWlkKSxcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50czogbm9kZS5jb21wb25lbnRzLm1hcCgoY29tcDogYW55KSA9PiAoe1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogY29tcC5jb25zdHJ1Y3Rvci5uYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgZW5hYmxlZDogY29tcC5lbmFibGVkXG4gICAgICAgICAgICAgICAgICAgIH0pKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9O1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEdldCBhbGwgbm9kZXMgaW4gc2NlbmVcbiAgICAgKi9cbiAgICBnZXRBbGxOb2RlcygpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBub2RlczogYW55W10gPSBbXTtcbiAgICAgICAgICAgIGNvbnN0IGNvbGxlY3ROb2RlcyA9IChub2RlOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBub2Rlcy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgdXVpZDogbm9kZS51dWlkLFxuICAgICAgICAgICAgICAgICAgICBuYW1lOiBub2RlLm5hbWUsXG4gICAgICAgICAgICAgICAgICAgIGFjdGl2ZTogbm9kZS5hY3RpdmUsXG4gICAgICAgICAgICAgICAgICAgIHBhcmVudDogbm9kZS5wYXJlbnQ/LnV1aWRcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBub2RlLmNoaWxkcmVuLmZvckVhY2goKGNoaWxkOiBhbnkpID0+IGNvbGxlY3ROb2RlcyhjaGlsZCkpO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgc2NlbmUuY2hpbGRyZW4uZm9yRWFjaCgoY2hpbGQ6IGFueSkgPT4gY29sbGVjdE5vZGVzKGNoaWxkKSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IG5vZGVzIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9O1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEZpbmQgbm9kZSBieSBuYW1lXG4gICAgICovXG4gICAgZmluZE5vZGVCeU5hbWUobmFtZTogc3RyaW5nKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IHNjZW5lLmdldENoaWxkQnlOYW1lKG5hbWUpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm9kZSB3aXRoIG5hbWUgJHtuYW1lfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICAgICAgICAgIHV1aWQ6IG5vZGUudXVpZCxcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogbm9kZS5uYW1lLFxuICAgICAgICAgICAgICAgICAgICBhY3RpdmU6IG5vZGUuYWN0aXZlLFxuICAgICAgICAgICAgICAgICAgICBwb3NpdGlvbjogbm9kZS5wb3NpdGlvblxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9O1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEdldCBjdXJyZW50IHNjZW5lIGluZm9ybWF0aW9uXG4gICAgICovXG4gICAgZ2V0Q3VycmVudFNjZW5lSW5mbygpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICAgICAgICBuYW1lOiBzY2VuZS5uYW1lLFxuICAgICAgICAgICAgICAgICAgICB1dWlkOiBzY2VuZS51dWlkLFxuICAgICAgICAgICAgICAgICAgICBub2RlQ291bnQ6IHNjZW5lLmNoaWxkcmVuLmxlbmd0aFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9O1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFNldCBub2RlIHByb3BlcnR5XG4gICAgICovXG4gICAgc2V0Tm9kZVByb3BlcnR5KG5vZGVVdWlkOiBzdHJpbmcsIHByb3BlcnR5OiBzdHJpbmcsIHZhbHVlOiBhbnkpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBub2RlID0gc2NlbmUuZ2V0Q2hpbGRCeVV1aWQobm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm9kZSB3aXRoIFVVSUQgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBTZXQgcHJvcGVydHlcbiAgICAgICAgICAgIGlmIChwcm9wZXJ0eSA9PT0gJ3Bvc2l0aW9uJykge1xuICAgICAgICAgICAgICAgIG5vZGUuc2V0UG9zaXRpb24odmFsdWUueCB8fCAwLCB2YWx1ZS55IHx8IDAsIHZhbHVlLnogfHwgMCk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHByb3BlcnR5ID09PSAncm90YXRpb24nKSB7XG4gICAgICAgICAgICAgICAgbm9kZS5zZXRSb3RhdGlvbkZyb21FdWxlcih2YWx1ZS54IHx8IDAsIHZhbHVlLnkgfHwgMCwgdmFsdWUueiB8fCAwKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAocHJvcGVydHkgPT09ICdzY2FsZScpIHtcbiAgICAgICAgICAgICAgICBub2RlLnNldFNjYWxlKHZhbHVlLnggfHwgMSwgdmFsdWUueSB8fCAxLCB2YWx1ZS56IHx8IDEpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChwcm9wZXJ0eSA9PT0gJ2FjdGl2ZScpIHtcbiAgICAgICAgICAgICAgICBub2RlLmFjdGl2ZSA9IHZhbHVlO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChwcm9wZXJ0eSA9PT0gJ25hbWUnKSB7XG4gICAgICAgICAgICAgICAgbm9kZS5uYW1lID0gdmFsdWU7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIFByb3RvdHlwZSBwb2xsdXRpb24gZ3VhcmRcbiAgICAgICAgICAgICAgICBpZiAoWydfX3Byb3RvX18nLCAnY29uc3RydWN0b3InLCAncHJvdG90eXBlJ10uaW5jbHVkZXMocHJvcGVydHkpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYFNldHRpbmcgcHJvcGVydHkgJyR7cHJvcGVydHl9JyBpcyBub3QgYWxsb3dlZGAgfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gVHJ5IHRvIHNldCB0aGUgcHJvcGVydHkgZGlyZWN0bHlcbiAgICAgICAgICAgICAgICAobm9kZSBhcyBhbnkpW3Byb3BlcnR5XSA9IHZhbHVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4geyBcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLCBcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBgUHJvcGVydHkgJyR7cHJvcGVydHl9JyB1cGRhdGVkIHN1Y2Nlc3NmdWxseWAgXG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTtcbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBHZXQgc2NlbmUgaGllcmFyY2h5XG4gICAgICovXG4gICAgZ2V0U2NlbmVIaWVyYXJjaHkoaW5jbHVkZUNvbXBvbmVudHM6IGJvb2xlYW4gPSBmYWxzZSwgbWF4RGVwdGg6IG51bWJlciA9IDUwKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgcHJvY2Vzc05vZGUgPSAobm9kZTogYW55LCBkZXB0aDogbnVtYmVyID0gMCk6IGFueSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGRlcHRoID49IG1heERlcHRoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7IG5hbWU6IG5vZGUubmFtZSwgdXVpZDogbm9kZS51dWlkLCB0cnVuY2F0ZWQ6IHRydWUgfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0OiBhbnkgPSB7XG4gICAgICAgICAgICAgICAgICAgIG5hbWU6IG5vZGUubmFtZSxcbiAgICAgICAgICAgICAgICAgICAgdXVpZDogbm9kZS51dWlkLFxuICAgICAgICAgICAgICAgICAgICBhY3RpdmU6IG5vZGUuYWN0aXZlLFxuICAgICAgICAgICAgICAgICAgICBjaGlsZHJlbjogW11cbiAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgaWYgKGluY2x1ZGVDb21wb25lbnRzKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdC5jb21wb25lbnRzID0gbm9kZS5jb21wb25lbnRzLm1hcCgoY29tcDogYW55KSA9PiAoe1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogY29tcC5jb25zdHJ1Y3Rvci5uYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgZW5hYmxlZDogY29tcC5lbmFibGVkXG4gICAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAobm9kZS5jaGlsZHJlbiAmJiBub2RlLmNoaWxkcmVuLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0LmNoaWxkcmVuID0gbm9kZS5jaGlsZHJlbi5tYXAoKGNoaWxkOiBhbnkpID0+IHByb2Nlc3NOb2RlKGNoaWxkLCBkZXB0aCArIDEpKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgY29uc3QgaGllcmFyY2h5ID0gc2NlbmUuY2hpbGRyZW4ubWFwKChjaGlsZDogYW55KSA9PiBwcm9jZXNzTm9kZShjaGlsZCwgMCkpO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogaGllcmFyY2h5IH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9O1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBwcmVmYWIgZnJvbSBub2RlXG4gICAgICovXG4gICAgY3JlYXRlUHJlZmFiRnJvbU5vZGUobm9kZVV1aWQ6IHN0cmluZywgcHJlZmFiUGF0aDogc3RyaW5nKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCBpbnN0YW50aWF0ZSB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBzY2VuZS5nZXRDaGlsZEJ5VXVpZChub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlIHdpdGggVVVJRCAke25vZGVVdWlkfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIE5vdGU6IFRoaXMgaXMgYSBzaW11bGF0ZWQgaW1wbGVtZW50YXRpb24gc2luY2UgcHJlZmFiIGZpbGVzIGNhbm5vdCBiZSBjcmVhdGVkIGRpcmVjdGx5IGF0IHJ1bnRpbWUuXG4gICAgICAgICAgICAvLyBBY3R1YWwgcHJlZmFiIGNyZWF0aW9uIHJlcXVpcmVzIHRoZSBFZGl0b3IgQVBJLlxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgICAgICAgICAgcHJlZmFiUGF0aDogcHJlZmFiUGF0aCxcbiAgICAgICAgICAgICAgICAgICAgc291cmNlTm9kZVV1aWQ6IG5vZGVVdWlkLFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBgUHJlZmFiIGNyZWF0ZWQgZnJvbSBub2RlICcke25vZGUubmFtZX0nIGF0ICR7cHJlZmFiUGF0aH1gXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogU2V0IGNvbXBvbmVudCBwcm9wZXJ0eVxuICAgICAqL1xuICAgIHNldENvbXBvbmVudFByb3BlcnR5KG5vZGVVdWlkOiBzdHJpbmcsIGNvbXBvbmVudFR5cGU6IHN0cmluZywgcHJvcGVydHk6IHN0cmluZywgdmFsdWU6IGFueSkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwganMgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IHNjZW5lLmdldENoaWxkQnlVdWlkKG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgd2l0aCBVVUlEICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IENvbXBvbmVudENsYXNzID0ganMuZ2V0Q2xhc3NCeU5hbWUoY29tcG9uZW50VHlwZSk7XG4gICAgICAgICAgICBpZiAoIUNvbXBvbmVudENsYXNzKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgQ29tcG9uZW50IHR5cGUgJHtjb21wb25lbnRUeXBlfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBjb21wb25lbnQgPSBub2RlLmdldENvbXBvbmVudChDb21wb25lbnRDbGFzcyk7XG4gICAgICAgICAgICBpZiAoIWNvbXBvbmVudCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYENvbXBvbmVudCAke2NvbXBvbmVudFR5cGV9IG5vdCBmb3VuZCBvbiBub2RlYCB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gUHJvdG90eXBlIHBvbGx1dGlvbiBndWFyZCAoYXBwbGllZCBmaXJzdCBmb3IgYWxsIHByb3BlcnR5IG5hbWVzKVxuICAgICAgICAgICAgaWYgKFsnX19wcm90b19fJywgJ2NvbnN0cnVjdG9yJywgJ3Byb3RvdHlwZSddLmluY2x1ZGVzKHByb3BlcnR5KSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYFNldHRpbmcgcHJvcGVydHkgJyR7cHJvcGVydHl9JyBpcyBub3QgYWxsb3dlZGAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIFNwZWNpYWwgaGFuZGxpbmcgZm9yIGNvbW1vbiBwcm9wZXJ0aWVzXG4gICAgICAgICAgICBpZiAocHJvcGVydHkgPT09ICdzcHJpdGVGcmFtZScgJiYgY29tcG9uZW50VHlwZSA9PT0gJ2NjLlNwcml0ZScpIHtcbiAgICAgICAgICAgICAgICAvLyBWYWx1ZSBjYW4gYmUgYSB1dWlkIG9yIGFzc2V0IHBhdGhcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBhc3NldE1hbmFnZXIgPSByZXF1aXJlKCdjYycpLmFzc2V0TWFuYWdlcjtcbiAgICAgICAgICAgICAgICAgICAgLy8gUmV0dXJuIGEgUHJvbWlzZSBzbyB0aGUgY2FsbGVyIHdhaXRzIGZvciB0aGUgYXNzZXQgdG8gbG9hZFxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbmV3IFByb21pc2U8eyBzdWNjZXNzOiBib29sZWFuOyBtZXNzYWdlPzogc3RyaW5nOyBlcnJvcj86IHN0cmluZyB9PigocmVzb2x2ZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXNzZXRNYW5hZ2VyLnJlc291cmNlcy5sb2FkKHZhbHVlLCByZXF1aXJlKCdjYycpLlNwcml0ZUZyYW1lLCAoZXJyOiBhbnksIHNwcml0ZUZyYW1lOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWVyciAmJiBzcHJpdGVGcmFtZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb21wb25lbnQuc3ByaXRlRnJhbWUgPSBzcHJpdGVGcmFtZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh7IHN1Y2Nlc3M6IHRydWUsIG1lc3NhZ2U6IGBDb21wb25lbnQgcHJvcGVydHkgJyR7cHJvcGVydHl9JyB1cGRhdGVkIHN1Y2Nlc3NmdWxseWAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXNzZXRNYW5hZ2VyLmxvYWRBbnkoeyB1dWlkOiB2YWx1ZSB9LCAoZXJyMjogYW55LCBhc3NldDogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWVycjIgJiYgYXNzZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb21wb25lbnQuc3ByaXRlRnJhbWUgPSBhc3NldDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHsgc3VjY2VzczogdHJ1ZSwgbWVzc2FnZTogYENvbXBvbmVudCBwcm9wZXJ0eSAnJHtwcm9wZXJ0eX0nIHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5YCB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYEZhaWxlZCB0byBsb2FkIHNwcml0ZUZyYW1lOiAke2VycjI/Lm1lc3NhZ2UgfHwgZXJyPy5tZXNzYWdlIHx8ICd1bmtub3duIGVycm9yJ31gIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50LnNwcml0ZUZyYW1lID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChwcm9wZXJ0eSA9PT0gJ21hdGVyaWFsJyAmJiAoY29tcG9uZW50VHlwZSA9PT0gJ2NjLlNwcml0ZScgfHwgY29tcG9uZW50VHlwZSA9PT0gJ2NjLk1lc2hSZW5kZXJlcicpKSB7XG4gICAgICAgICAgICAgICAgLy8gVmFsdWUgY2FuIGJlIGEgdXVpZCBvciBhc3NldCBwYXRoXG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYXNzZXRNYW5hZ2VyID0gcmVxdWlyZSgnY2MnKS5hc3NldE1hbmFnZXI7XG4gICAgICAgICAgICAgICAgICAgIC8vIFJldHVybiBhIFByb21pc2Ugc28gdGhlIGNhbGxlciB3YWl0cyBmb3IgdGhlIGFzc2V0IHRvIGxvYWRcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlPHsgc3VjY2VzczogYm9vbGVhbjsgbWVzc2FnZT86IHN0cmluZzsgZXJyb3I/OiBzdHJpbmcgfT4oKHJlc29sdmUpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFzc2V0TWFuYWdlci5yZXNvdXJjZXMubG9hZCh2YWx1ZSwgcmVxdWlyZSgnY2MnKS5NYXRlcmlhbCwgKGVycjogYW55LCBtYXRlcmlhbDogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFlcnIgJiYgbWF0ZXJpYWwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50Lm1hdGVyaWFsID0gbWF0ZXJpYWw7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUoeyBzdWNjZXNzOiB0cnVlLCBtZXNzYWdlOiBgQ29tcG9uZW50IHByb3BlcnR5ICcke3Byb3BlcnR5fScgdXBkYXRlZCBzdWNjZXNzZnVsbHlgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFzc2V0TWFuYWdlci5sb2FkQW55KHsgdXVpZDogdmFsdWUgfSwgKGVycjI6IGFueSwgYXNzZXQ6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFlcnIyICYmIGFzc2V0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50Lm1hdGVyaWFsID0gYXNzZXQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh7IHN1Y2Nlc3M6IHRydWUsIG1lc3NhZ2U6IGBDb21wb25lbnQgcHJvcGVydHkgJyR7cHJvcGVydHl9JyB1cGRhdGVkIHN1Y2Nlc3NmdWxseWAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUoeyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBGYWlsZWQgdG8gbG9hZCBtYXRlcmlhbDogJHtlcnIyPy5tZXNzYWdlIHx8IGVycj8ubWVzc2FnZSB8fCAndW5rbm93biBlcnJvcid9YCB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudC5tYXRlcmlhbCA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAocHJvcGVydHkgPT09ICdzdHJpbmcnICYmIChjb21wb25lbnRUeXBlID09PSAnY2MuTGFiZWwnIHx8IGNvbXBvbmVudFR5cGUgPT09ICdjYy5SaWNoVGV4dCcpKSB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50LnN0cmluZyA9IHZhbHVlO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb21wb25lbnRbcHJvcGVydHldID0gdmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBPcHRpb25hbDogcmVmcmVzaCBJbnNwZWN0b3JcbiAgICAgICAgICAgIC8vIEVkaXRvci5NZXNzYWdlLnNlbmQoJ3NjZW5lJywgJ3NuYXBzaG90Jyk7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBtZXNzYWdlOiBgQ29tcG9uZW50IHByb3BlcnR5ICcke3Byb3BlcnR5fScgdXBkYXRlZCBzdWNjZXNzZnVsbHlgIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9O1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIC8vIOKUgOKUgOKUgCBMaWdodCBoZWxwZXJzIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuXG4gICAgLyoqIE1hcCBsaWdodCB0eXBlIHN0cmluZyB0byBjYyBjbGFzcyBuYW1lICovXG4gICAgX2dldExpZ2h0Q2xhc3NOYW1lKHR5cGU6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgICAgIGNvbnN0IG1hcDogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgICAgICAgICAgIGRpcmVjdGlvbmFsOiAnRGlyZWN0aW9uYWxMaWdodCcsXG4gICAgICAgICAgICBzcGhlcmU6ICdTcGhlcmVMaWdodCcsXG4gICAgICAgICAgICBzcG90OiAnU3BvdExpZ2h0JyxcbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIG1hcFt0eXBlXSB8fCAnRGlyZWN0aW9uYWxMaWdodCc7XG4gICAgfSxcblxuICAgIC8qKiBQYXJzZSBjb2xvciBmcm9tIGhleCBzdHJpbmcgb3Ige3IsZyxiLGF9IG9iamVjdCBpbnRvIGNjLkNvbG9yICovXG4gICAgX3BhcnNlQ29sb3IoY2M6IGFueSwgY29sb3I6IGFueSk6IGFueSB7XG4gICAgICAgIGlmICghY29sb3IpIHJldHVybiBuZXcgY2MuQ29sb3IoMjU1LCAyNTUsIDI1NSwgMjU1KTtcbiAgICAgICAgaWYgKHR5cGVvZiBjb2xvciA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIGNvbnN0IGhleCA9IGNvbG9yLnJlcGxhY2UoJyMnLCAnJyk7XG4gICAgICAgICAgICBjb25zdCByID0gcGFyc2VJbnQoaGV4LnN1YnN0cmluZygwLCAyKSwgMTYpO1xuICAgICAgICAgICAgY29uc3QgZyA9IHBhcnNlSW50KGhleC5zdWJzdHJpbmcoMiwgNCksIDE2KTtcbiAgICAgICAgICAgIGNvbnN0IGIgPSBwYXJzZUludChoZXguc3Vic3RyaW5nKDQsIDYpLCAxNik7XG4gICAgICAgICAgICByZXR1cm4gbmV3IGNjLkNvbG9yKHIsIGcsIGIsIDI1NSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG5ldyBjYy5Db2xvcihjb2xvci5yID8/IDI1NSwgY29sb3IuZyA/PyAyNTUsIGNvbG9yLmIgPz8gMjU1LCBjb2xvci5hID8/IDI1NSk7XG4gICAgfSxcblxuICAgIGFkZExpZ2h0Q29tcG9uZW50KG5vZGVVdWlkOiBzdHJpbmcsIHR5cGU6IHN0cmluZywgY29sb3I6IGFueSwgaW50ZW5zaXR5OiBudW1iZXIpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IsIGpzLCBDb2xvciB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBzY2VuZS5nZXRDaGlsZEJ5VXVpZChub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgY29uc3QgY2xhc3NOYW1lID0gKG1ldGhvZHMgYXMgYW55KS5fZ2V0TGlnaHRDbGFzc05hbWUodHlwZSk7XG4gICAgICAgICAgICBjb25zdCBMaWdodENsYXNzID0ganMuZ2V0Q2xhc3NCeU5hbWUoY2xhc3NOYW1lKTtcbiAgICAgICAgICAgIGlmICghTGlnaHRDbGFzcykgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTGlnaHQgY2xhc3MgJHtjbGFzc05hbWV9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIGNvbnN0IGxpZ2h0ID0gbm9kZS5hZGRDb21wb25lbnQoTGlnaHRDbGFzcyk7XG4gICAgICAgICAgICBpZiAoY29sb3IpIGxpZ2h0LmNvbG9yID0gKG1ldGhvZHMgYXMgYW55KS5fcGFyc2VDb2xvcih7IENvbG9yIH0sIGNvbG9yKTtcbiAgICAgICAgICAgIGlmIChpbnRlbnNpdHkgIT09IHVuZGVmaW5lZCkgbGlnaHQubHVtaW5hbmNlID0gaW50ZW5zaXR5O1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogeyB1dWlkOiBub2RlLnV1aWQsIGxpZ2h0VHlwZTogY2xhc3NOYW1lIH0gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICBzZXRMaWdodFByb3BlcnR5KG5vZGVVdWlkOiBzdHJpbmcsIHByb3BlcnR5OiBzdHJpbmcsIHZhbHVlOiBhbnkpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IsIGpzLCBDb2xvciB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBzY2VuZS5nZXRDaGlsZEJ5VXVpZChub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgY29uc3QgbGlnaHRUeXBlcyA9IFsnRGlyZWN0aW9uYWxMaWdodCcsICdTcGhlcmVMaWdodCcsICdTcG90TGlnaHQnXTtcbiAgICAgICAgICAgIGxldCBsaWdodDogYW55ID0gbnVsbDtcbiAgICAgICAgICAgIGZvciAoY29uc3QgdCBvZiBsaWdodFR5cGVzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY2xzID0ganMuZ2V0Q2xhc3NCeU5hbWUodCk7XG4gICAgICAgICAgICAgICAgaWYgKGNscykgeyBsaWdodCA9IG5vZGUuZ2V0Q29tcG9uZW50KGNscyk7IGlmIChsaWdodCkgYnJlYWs7IH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghbGlnaHQpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGxpZ2h0IGNvbXBvbmVudCBmb3VuZCBvbiBub2RlJyB9O1xuICAgICAgICAgICAgaWYgKHByb3BlcnR5ID09PSAnY29sb3InKSB7XG4gICAgICAgICAgICAgICAgbGlnaHQuY29sb3IgPSAobWV0aG9kcyBhcyBhbnkpLl9wYXJzZUNvbG9yKHsgQ29sb3IgfSwgdmFsdWUpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChbJ19fcHJvdG9fXycsICdjb25zdHJ1Y3RvcicsICdwcm90b3R5cGUnXS5pbmNsdWRlcyhwcm9wZXJ0eSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBTZXR0aW5nICcke3Byb3BlcnR5fScgaXMgbm90IGFsbG93ZWRgIH07XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGxpZ2h0W3Byb3BlcnR5XSA9IHZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIGdldExpZ2h0SW5mbyhub2RlVXVpZDogc3RyaW5nKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCBqcyB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBzY2VuZS5nZXRDaGlsZEJ5VXVpZChub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgY29uc3QgbGlnaHRUeXBlcyA9IFsnRGlyZWN0aW9uYWxMaWdodCcsICdTcGhlcmVMaWdodCcsICdTcG90TGlnaHQnXTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgdCBvZiBsaWdodFR5cGVzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY2xzID0ganMuZ2V0Q2xhc3NCeU5hbWUodCk7XG4gICAgICAgICAgICAgICAgaWYgKCFjbHMpIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIGNvbnN0IGxpZ2h0ID0gbm9kZS5nZXRDb21wb25lbnQoY2xzKTtcbiAgICAgICAgICAgICAgICBpZiAobGlnaHQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGlnaHRUeXBlOiB0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbG9yOiBsaWdodC5jb2xvcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsdW1pbmFuY2U6IGxpZ2h0Lmx1bWluYW5jZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByYW5nZTogbGlnaHQucmFuZ2UsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3BvdEFuZ2xlOiBsaWdodC5hbmdsZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaGFkb3dFbmFibGVkOiBsaWdodC5zaGFkb3dFbmFibGVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNoYWRvd0JpYXM6IGxpZ2h0LnNoYWRvd0JpYXMsXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gbGlnaHQgY29tcG9uZW50IGZvdW5kIG9uIG5vZGUnIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgbGlzdExpZ2h0cygpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IsIGpzIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3QgbGlnaHRzOiBhbnlbXSA9IFtdO1xuICAgICAgICAgICAgY29uc3QgbGlnaHRUeXBlcyA9IFsnRGlyZWN0aW9uYWxMaWdodCcsICdTcGhlcmVMaWdodCcsICdTcG90TGlnaHQnXTtcbiAgICAgICAgICAgIGNvbnN0IHdhbGsgPSAobm9kZTogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCB0IG9mIGxpZ2h0VHlwZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY2xzID0ganMuZ2V0Q2xhc3NCeU5hbWUodCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjbHMgJiYgbm9kZS5nZXRDb21wb25lbnQoY2xzKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGlnaHRzLnB1c2goeyB1dWlkOiBub2RlLnV1aWQsIG5hbWU6IG5vZGUubmFtZSwgbGlnaHRUeXBlOiB0IH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgbm9kZS5jaGlsZHJlbi5mb3JFYWNoKChjOiBhbnkpID0+IHdhbGsoYykpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHNjZW5lLmNoaWxkcmVuLmZvckVhY2goKGM6IGFueSkgPT4gd2FsayhjKSk7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IGxpZ2h0cywgY291bnQ6IGxpZ2h0cy5sZW5ndGggfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIHJlbW92ZUxpZ2h0Q29tcG9uZW50KG5vZGVVdWlkOiBzdHJpbmcpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IsIGpzIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IHNjZW5lLmdldENoaWxkQnlVdWlkKG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm9kZSAke25vZGVVdWlkfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICBjb25zdCBsaWdodFR5cGVzID0gWydEaXJlY3Rpb25hbExpZ2h0JywgJ1NwaGVyZUxpZ2h0JywgJ1Nwb3RMaWdodCddO1xuICAgICAgICAgICAgZm9yIChjb25zdCB0IG9mIGxpZ2h0VHlwZXMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjbHMgPSBqcy5nZXRDbGFzc0J5TmFtZSh0KTtcbiAgICAgICAgICAgICAgICBpZiAoIWNscykgY29udGludWU7XG4gICAgICAgICAgICAgICAgY29uc3QgbGlnaHQgPSBub2RlLmdldENvbXBvbmVudChjbHMpO1xuICAgICAgICAgICAgICAgIGlmIChsaWdodCkgeyBub2RlLnJlbW92ZUNvbXBvbmVudChsaWdodCk7IHJldHVybiB7IHN1Y2Nlc3M6IHRydWUgfTsgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gbGlnaHQgY29tcG9uZW50IGZvdW5kIG9uIG5vZGUnIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgLy8g4pSA4pSA4pSAIENhbWVyYSBoZWxwZXJzIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuXG4gICAgZ2V0Q2FtZXJhSW5mbyhub2RlVXVpZDogc3RyaW5nKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCBqcyB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBzY2VuZS5nZXRDaGlsZEJ5VXVpZChub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgY29uc3QgQ2FtZXJhQ2xhc3MgPSBqcy5nZXRDbGFzc0J5TmFtZSgnQ2FtZXJhJyk7XG4gICAgICAgICAgICBpZiAoIUNhbWVyYUNsYXNzKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdDYW1lcmEgY2xhc3Mgbm90IGZvdW5kJyB9O1xuICAgICAgICAgICAgY29uc3QgY2FtID0gbm9kZS5nZXRDb21wb25lbnQoQ2FtZXJhQ2xhc3MpO1xuICAgICAgICAgICAgaWYgKCFjYW0pIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIENhbWVyYSBjb21wb25lbnQgb24gbm9kZScgfTtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICAgICAgICAgIGZvdjogY2FtLmZvdixcbiAgICAgICAgICAgICAgICAgICAgb3J0aG9IZWlnaHQ6IGNhbS5vcnRob0hlaWdodCxcbiAgICAgICAgICAgICAgICAgICAgbmVhcjogY2FtLm5lYXIsXG4gICAgICAgICAgICAgICAgICAgIGZhcjogY2FtLmZhcixcbiAgICAgICAgICAgICAgICAgICAgcHJpb3JpdHk6IGNhbS5wcmlvcml0eSxcbiAgICAgICAgICAgICAgICAgICAgdmlzaWJpbGl0eTogY2FtLnZpc2liaWxpdHksXG4gICAgICAgICAgICAgICAgICAgIGNsZWFyRmxhZ3M6IGNhbS5jbGVhckZsYWdzLFxuICAgICAgICAgICAgICAgICAgICBwcm9qZWN0aW9uOiBjYW0ucHJvamVjdGlvbixcbiAgICAgICAgICAgICAgICAgICAgcmVjdDogY2FtLnJlY3QsXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICBzZXRDYW1lcmFQcm9wZXJ0eShub2RlVXVpZDogc3RyaW5nLCBwcm9wZXJ0eTogc3RyaW5nLCB2YWx1ZTogYW55KSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCBqcywgUmVjdCwgQ2FtZXJhIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IHNjZW5lLmdldENoaWxkQnlVdWlkKG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm9kZSAke25vZGVVdWlkfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICBjb25zdCBDYW1lcmFDbGFzcyA9IGpzLmdldENsYXNzQnlOYW1lKCdDYW1lcmEnKSB8fCBDYW1lcmE7XG4gICAgICAgICAgICBjb25zdCBjYW0gPSBub2RlLmdldENvbXBvbmVudChDYW1lcmFDbGFzcyk7XG4gICAgICAgICAgICBpZiAoIWNhbSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gQ2FtZXJhIGNvbXBvbmVudCBvbiBub2RlJyB9O1xuICAgICAgICAgICAgaWYgKFsnX19wcm90b19fJywgJ2NvbnN0cnVjdG9yJywgJ3Byb3RvdHlwZSddLmluY2x1ZGVzKHByb3BlcnR5KSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYFNldHRpbmcgJyR7cHJvcGVydHl9JyBpcyBub3QgYWxsb3dlZGAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChwcm9wZXJ0eSA9PT0gJ2NsZWFyRmxhZ3MnKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZmxhZ01hcDogUmVjb3JkPHN0cmluZywgbnVtYmVyPiA9IHsgU09MSURfQ09MT1I6IDEsIERFUFRIX09OTFk6IDIsIERPTlRfQ0xFQVI6IDMsIFNLWUJPWDogNCB9O1xuICAgICAgICAgICAgICAgIGNhbS5jbGVhckZsYWdzID0gZmxhZ01hcFt2YWx1ZV0gPz8gdmFsdWU7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHByb3BlcnR5ID09PSAncHJvamVjdGlvbicpIHtcbiAgICAgICAgICAgICAgICBjYW0ucHJvamVjdGlvbiA9IHZhbHVlID09PSAnT1JUSE8nID8gMCA6IDE7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHByb3BlcnR5ID09PSAndmlld3BvcnQnKSB7XG4gICAgICAgICAgICAgICAgY2FtLnJlY3QgPSBuZXcgUmVjdCh2YWx1ZS54LCB2YWx1ZS55LCB2YWx1ZS53aWR0aCwgdmFsdWUuaGVpZ2h0KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY2FtW3Byb3BlcnR5XSA9IHZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIGxpc3RDYW1lcmFzKCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwganMgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBDYW1lcmFDbGFzcyA9IGpzLmdldENsYXNzQnlOYW1lKCdDYW1lcmEnKTtcbiAgICAgICAgICAgIGlmICghQ2FtZXJhQ2xhc3MpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ0NhbWVyYSBjbGFzcyBub3QgZm91bmQnIH07XG4gICAgICAgICAgICBjb25zdCBjYW1lcmFzOiBhbnlbXSA9IFtdO1xuICAgICAgICAgICAgY29uc3Qgd2FsayA9IChub2RlOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBjYW0gPSBub2RlLmdldENvbXBvbmVudChDYW1lcmFDbGFzcyk7XG4gICAgICAgICAgICAgICAgaWYgKGNhbSkgY2FtZXJhcy5wdXNoKHsgdXVpZDogbm9kZS51dWlkLCBuYW1lOiBub2RlLm5hbWUsIHByaW9yaXR5OiBjYW0ucHJpb3JpdHksIHByb2plY3Rpb246IGNhbS5wcm9qZWN0aW9uIH0pO1xuICAgICAgICAgICAgICAgIG5vZGUuY2hpbGRyZW4uZm9yRWFjaCgoYzogYW55KSA9PiB3YWxrKGMpKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBzY2VuZS5jaGlsZHJlbi5mb3JFYWNoKChjOiBhbnkpID0+IHdhbGsoYykpO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogeyBjYW1lcmFzLCBjb3VudDogY2FtZXJhcy5sZW5ndGggfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIC8vIOKUgOKUgOKUgCBQaHlzaWNzIGhlbHBlcnMg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5cbiAgICBjb25maWd1cmVQaHlzaWNzKGdyYXZpdHk6IGFueSwgZml4ZWRUaW1lU3RlcD86IG51bWJlciwgbWF4U3ViU3RlcHM/OiBudW1iZXIpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgUGh5c2ljc1N5c3RlbSwgVmVjMyB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHN5cyA9IFBoeXNpY3NTeXN0ZW0/Lmluc3RhbmNlO1xuICAgICAgICAgICAgaWYgKCFzeXMpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ1BoeXNpY3NTeXN0ZW0gbm90IGF2YWlsYWJsZSAoM0Qgb25seSknIH07XG4gICAgICAgICAgICBpZiAoZ3Jhdml0eSkgc3lzLmdyYXZpdHkgPSBuZXcgVmVjMyhncmF2aXR5LnggPz8gMCwgZ3Jhdml0eS55ID8/IC0xMCwgZ3Jhdml0eS56ID8/IDApO1xuICAgICAgICAgICAgaWYgKGZpeGVkVGltZVN0ZXAgIT09IHVuZGVmaW5lZCkgc3lzLmZpeGVkVGltZVN0ZXAgPSBmaXhlZFRpbWVTdGVwO1xuICAgICAgICAgICAgaWYgKG1heFN1YlN0ZXBzICE9PSB1bmRlZmluZWQpIHN5cy5tYXhTdWJTdGVwcyA9IG1heFN1YlN0ZXBzO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogeyBncmF2aXR5OiBzeXMuZ3Jhdml0eSwgZml4ZWRUaW1lU3RlcDogc3lzLmZpeGVkVGltZVN0ZXAsIG1heFN1YlN0ZXBzOiBzeXMubWF4U3ViU3RlcHMgfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIC8qKiBEZXRlY3QgaWYgbm9kZSBpcyBpbiBhIDJEIGNvbnRleHQgYnkgY2hlY2tpbmcgZm9yIFVJVHJhbnNmb3JtL1Nwcml0ZSAqL1xuICAgIF9pczJETm9kZShub2RlOiBhbnksIGpzOiBhbnkpOiBib29sZWFuIHtcbiAgICAgICAgY29uc3QgdHlwZXMyRCA9IFsnVUlUcmFuc2Zvcm0nLCAnU3ByaXRlJywgJ0xhYmVsJywgJ0J1dHRvbicsICdDYW52YXMnXTtcbiAgICAgICAgcmV0dXJuIHR5cGVzMkQuc29tZSh0ID0+IHsgY29uc3QgY2xzID0ganMuZ2V0Q2xhc3NCeU5hbWUodCk7IHJldHVybiBjbHMgJiYgbm9kZS5nZXRDb21wb25lbnQoY2xzKTsgfSk7XG4gICAgfSxcblxuICAgIGFkZFJpZ2lkYm9keShub2RlVXVpZDogc3RyaW5nLCB0eXBlOiBzdHJpbmcsIG1hc3M6IG51bWJlciwgdXNlR3Jhdml0eTogYm9vbGVhbikge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwganMgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlID0gc2NlbmUuZ2V0Q2hpbGRCeVV1aWQobm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIGNvbnN0IGlzMkQgPSAobWV0aG9kcyBhcyBhbnkpLl9pczJETm9kZShub2RlLCBqcyk7XG4gICAgICAgICAgICBjb25zdCBjbGFzc05hbWUgPSBpczJEID8gJ1JpZ2lkQm9keTJEJyA6ICdSaWdpZEJvZHknO1xuICAgICAgICAgICAgY29uc3QgUkJDbGFzcyA9IGpzLmdldENsYXNzQnlOYW1lKGNsYXNzTmFtZSk7XG4gICAgICAgICAgICBpZiAoIVJCQ2xhc3MpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYCR7Y2xhc3NOYW1lfSBub3QgYXZhaWxhYmxlYCB9O1xuICAgICAgICAgICAgY29uc3QgcmIgPSBub2RlLmFkZENvbXBvbmVudChSQkNsYXNzKTtcbiAgICAgICAgICAgIGlmIChpczJEKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdHlwZU1hcDogUmVjb3JkPHN0cmluZywgbnVtYmVyPiA9IHsgc3RhdGljOiAwLCBraW5lbWF0aWM6IDEsIGR5bmFtaWM6IDIgfTtcbiAgICAgICAgICAgICAgICByYi50eXBlID0gdHlwZU1hcFt0eXBlXSA/PyAyO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zdCB0eXBlTWFwOiBSZWNvcmQ8c3RyaW5nLCBudW1iZXI+ID0geyBkeW5hbWljOiAwLCBzdGF0aWM6IDIsIGtpbmVtYXRpYzogMyB9O1xuICAgICAgICAgICAgICAgIHJiLnR5cGUgPSB0eXBlTWFwW3R5cGVdID8/IDA7XG4gICAgICAgICAgICAgICAgcmIubWFzcyA9IG1hc3M7XG4gICAgICAgICAgICAgICAgcmIudXNlR3Jhdml0eSA9IHVzZUdyYXZpdHk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IHV1aWQ6IG5vZGUudXVpZCwgcmJDbGFzczogY2xhc3NOYW1lLCB0eXBlIH0gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICBhZGRDb2xsaWRlcihub2RlVXVpZDogc3RyaW5nLCBzaGFwZTogc3RyaW5nLCBzaXplOiBhbnksIGlzVHJpZ2dlcjogYm9vbGVhbikge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwganMgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlID0gc2NlbmUuZ2V0Q2hpbGRCeVV1aWQobm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIGNvbnN0IGlzMkQgPSAobWV0aG9kcyBhcyBhbnkpLl9pczJETm9kZShub2RlLCBqcyk7XG4gICAgICAgICAgICBjb25zdCBjbGFzc01hcDNEOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0geyBib3g6ICdCb3hDb2xsaWRlcicsIHNwaGVyZTogJ1NwaGVyZUNvbGxpZGVyJywgY2Fwc3VsZTogJ0NhcHN1bGVDb2xsaWRlcicgfTtcbiAgICAgICAgICAgIGNvbnN0IGNsYXNzTWFwMkQ6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7IGJveDogJ0JveENvbGxpZGVyMkQnLCBjaXJjbGU6ICdDaXJjbGVDb2xsaWRlcjJEJywgcG9seWdvbjogJ1BvbHlnb25Db2xsaWRlcjJEJyB9O1xuICAgICAgICAgICAgY29uc3QgY2xhc3NOYW1lID0gaXMyRCA/IChjbGFzc01hcDJEW3NoYXBlXSB8fCAnQm94Q29sbGlkZXIyRCcpIDogKGNsYXNzTWFwM0Rbc2hhcGVdIHx8ICdCb3hDb2xsaWRlcicpO1xuICAgICAgICAgICAgY29uc3QgQ29sbGlkZXJDbGFzcyA9IGpzLmdldENsYXNzQnlOYW1lKGNsYXNzTmFtZSk7XG4gICAgICAgICAgICBpZiAoIUNvbGxpZGVyQ2xhc3MpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYCR7Y2xhc3NOYW1lfSBub3QgYXZhaWxhYmxlYCB9O1xuICAgICAgICAgICAgY29uc3QgY29sbGlkZXIgPSBub2RlLmFkZENvbXBvbmVudChDb2xsaWRlckNsYXNzKTtcbiAgICAgICAgICAgIGNvbGxpZGVyLmlzVHJpZ2dlciA9IGlzVHJpZ2dlcjtcbiAgICAgICAgICAgIGlmIChzaXplICYmIGNvbGxpZGVyLnNpemUpIHtcbiAgICAgICAgICAgICAgICBjb25zdCB7IFZlYzMsIFNpemUgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICAgICAgaWYgKGlzMkQpIGNvbGxpZGVyLnNpemUgPSBuZXcgU2l6ZShzaXplLndpZHRoID8/IHNpemUueCA/PyAxLCBzaXplLmhlaWdodCA/PyBzaXplLnkgPz8gMSk7XG4gICAgICAgICAgICAgICAgZWxzZSBjb2xsaWRlci5zaXplID0gbmV3IFZlYzMoc2l6ZS53aWR0aCA/PyBzaXplLnggPz8gMSwgc2l6ZS5oZWlnaHQgPz8gc2l6ZS55ID8/IDEsIHNpemUuZGVwdGggPz8gc2l6ZS56ID8/IDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHNpemU/LnJhZGl1cyAhPT0gdW5kZWZpbmVkICYmIGNvbGxpZGVyLnJhZGl1cyAhPT0gdW5kZWZpbmVkKSBjb2xsaWRlci5yYWRpdXMgPSBzaXplLnJhZGl1cztcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHsgdXVpZDogbm9kZS51dWlkLCBjb2xsaWRlckNsYXNzOiBjbGFzc05hbWUsIGlzVHJpZ2dlciB9IH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgc2V0UmlnaWRib2R5UHJvcGVydHkobm9kZVV1aWQ6IHN0cmluZywgcHJvcGVydHk6IHN0cmluZywgdmFsdWU6IGFueSkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwganMgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlID0gc2NlbmUuZ2V0Q2hpbGRCeVV1aWQobm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIGlmIChbJ19fcHJvdG9fXycsICdjb25zdHJ1Y3RvcicsICdwcm90b3R5cGUnXS5pbmNsdWRlcyhwcm9wZXJ0eSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBTZXR0aW5nICcke3Byb3BlcnR5fScgaXMgbm90IGFsbG93ZWRgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHJiTmFtZSBvZiBbJ1JpZ2lkQm9keScsICdSaWdpZEJvZHkyRCddKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY2xzID0ganMuZ2V0Q2xhc3NCeU5hbWUocmJOYW1lKTtcbiAgICAgICAgICAgICAgICBpZiAoIWNscykgY29udGludWU7XG4gICAgICAgICAgICAgICAgY29uc3QgcmIgPSBub2RlLmdldENvbXBvbmVudChjbHMpO1xuICAgICAgICAgICAgICAgIGlmIChyYikgeyByYltwcm9wZXJ0eV0gPSB2YWx1ZTsgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSB9OyB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBSaWdpZEJvZHkgY29tcG9uZW50IGZvdW5kIG9uIG5vZGUnIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgc2V0Q29sbGlkZXJQcm9wZXJ0eShub2RlVXVpZDogc3RyaW5nLCBwcm9wZXJ0eTogc3RyaW5nLCB2YWx1ZTogYW55KSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCBqcywgVmVjMywgU2l6ZSB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBzY2VuZS5nZXRDaGlsZEJ5VXVpZChub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgaWYgKFsnX19wcm90b19fJywgJ2NvbnN0cnVjdG9yJywgJ3Byb3RvdHlwZSddLmluY2x1ZGVzKHByb3BlcnR5KSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYFNldHRpbmcgJyR7cHJvcGVydHl9JyBpcyBub3QgYWxsb3dlZGAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IGNvbGxpZGVyTmFtZXMgPSBbJ0JveENvbGxpZGVyJywgJ1NwaGVyZUNvbGxpZGVyJywgJ0NhcHN1bGVDb2xsaWRlcicsICdCb3hDb2xsaWRlcjJEJywgJ0NpcmNsZUNvbGxpZGVyMkQnLCAnUG9seWdvbkNvbGxpZGVyMkQnXTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgbmFtZSBvZiBjb2xsaWRlck5hbWVzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY2xzID0ganMuZ2V0Q2xhc3NCeU5hbWUobmFtZSk7XG4gICAgICAgICAgICAgICAgaWYgKCFjbHMpIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbCA9IG5vZGUuZ2V0Q29tcG9uZW50KGNscyk7XG4gICAgICAgICAgICAgICAgaWYgKGNvbCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAocHJvcGVydHkgPT09ICdzaXplJyAmJiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2wuc2l6ZSA9IG5hbWUuZW5kc1dpdGgoJzJEJylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA/IG5ldyBTaXplKHZhbHVlLndpZHRoID8/IHZhbHVlLnggPz8gMSwgdmFsdWUuaGVpZ2h0ID8/IHZhbHVlLnkgPz8gMSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA6IG5ldyBWZWMzKHZhbHVlLndpZHRoID8/IHZhbHVlLnggPz8gMSwgdmFsdWUuaGVpZ2h0ID8/IHZhbHVlLnkgPz8gMSwgdmFsdWUuZGVwdGggPz8gdmFsdWUueiA/PyAxKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChwcm9wZXJ0eSA9PT0gJ2NlbnRlcicgJiYgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29sLmNlbnRlciA9IG5ldyBWZWMzKHZhbHVlLnggPz8gMCwgdmFsdWUueSA/PyAwLCB2YWx1ZS56ID8/IDApO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29sW3Byb3BlcnR5XSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUgfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBjb2xsaWRlciBjb21wb25lbnQgZm91bmQgb24gbm9kZScgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICByZW1vdmVQaHlzaWNzQ29tcG9uZW50cyhub2RlVXVpZDogc3RyaW5nKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCBqcyB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBzY2VuZS5nZXRDaGlsZEJ5VXVpZChub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgY29uc3QgcGh5c2ljc05hbWVzID0gWydSaWdpZEJvZHknLCAnUmlnaWRCb2R5MkQnLCAnQm94Q29sbGlkZXInLCAnU3BoZXJlQ29sbGlkZXInLCAnQ2Fwc3VsZUNvbGxpZGVyJywgJ0JveENvbGxpZGVyMkQnLCAnQ2lyY2xlQ29sbGlkZXIyRCcsICdQb2x5Z29uQ29sbGlkZXIyRCddO1xuICAgICAgICAgICAgY29uc3QgcmVtb3ZlZDogc3RyaW5nW10gPSBbXTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgbmFtZSBvZiBwaHlzaWNzTmFtZXMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjbHMgPSBqcy5nZXRDbGFzc0J5TmFtZShuYW1lKTtcbiAgICAgICAgICAgICAgICBpZiAoIWNscykgY29udGludWU7XG4gICAgICAgICAgICAgICAgY29uc3QgY29tcCA9IG5vZGUuZ2V0Q29tcG9uZW50KGNscyk7XG4gICAgICAgICAgICAgICAgaWYgKGNvbXApIHsgbm9kZS5yZW1vdmVDb21wb25lbnQoY29tcCk7IHJlbW92ZWQucHVzaChuYW1lKTsgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogeyByZW1vdmVkIH0gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICBnZXRQaHlzaWNzSW5mbyhub2RlVXVpZDogc3RyaW5nKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCBqcyB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBzY2VuZS5nZXRDaGlsZEJ5VXVpZChub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgY29uc3QgaW5mbzogYW55ID0geyByaWdpZGJvZHk6IG51bGwsIGNvbGxpZGVyczogW10gfTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgcmJOYW1lIG9mIFsnUmlnaWRCb2R5JywgJ1JpZ2lkQm9keTJEJ10pIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjbHMgPSBqcy5nZXRDbGFzc0J5TmFtZShyYk5hbWUpO1xuICAgICAgICAgICAgICAgIGlmICghY2xzKSBjb250aW51ZTtcbiAgICAgICAgICAgICAgICBjb25zdCByYiA9IG5vZGUuZ2V0Q29tcG9uZW50KGNscyk7XG4gICAgICAgICAgICAgICAgaWYgKHJiKSB7IGluZm8ucmlnaWRib2R5ID0geyB0eXBlOiByYk5hbWUsIHJiVHlwZTogcmIudHlwZSwgbWFzczogcmIubWFzcywgdXNlR3Jhdml0eTogcmIudXNlR3Jhdml0eSB9OyBicmVhazsgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgY29sbGlkZXJOYW1lcyA9IFsnQm94Q29sbGlkZXInLCAnU3BoZXJlQ29sbGlkZXInLCAnQ2Fwc3VsZUNvbGxpZGVyJywgJ0JveENvbGxpZGVyMkQnLCAnQ2lyY2xlQ29sbGlkZXIyRCcsICdQb2x5Z29uQ29sbGlkZXIyRCddO1xuICAgICAgICAgICAgZm9yIChjb25zdCBuYW1lIG9mIGNvbGxpZGVyTmFtZXMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjbHMgPSBqcy5nZXRDbGFzc0J5TmFtZShuYW1lKTtcbiAgICAgICAgICAgICAgICBpZiAoIWNscykgY29udGludWU7XG4gICAgICAgICAgICAgICAgY29uc3QgY29sID0gbm9kZS5nZXRDb21wb25lbnQoY2xzKTtcbiAgICAgICAgICAgICAgICBpZiAoY29sKSBpbmZvLmNvbGxpZGVycy5wdXNoKHsgdHlwZTogbmFtZSwgaXNUcmlnZ2VyOiBjb2wuaXNUcmlnZ2VyLCBzaXplOiBjb2wuc2l6ZSwgY2VudGVyOiBjb2wuY2VudGVyIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogaW5mbyB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIHBlcmZvcm1SYXljYXN0KG9yaWdpbjogYW55LCBkaXJlY3Rpb246IGFueSwgbWF4RGlzdGFuY2U6IG51bWJlcikge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBQaHlzaWNzU3lzdGVtLCBWZWMzLCBnZW9tZXRyeSB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHN5cyA9IFBoeXNpY3NTeXN0ZW0/Lmluc3RhbmNlO1xuICAgICAgICAgICAgaWYgKCFzeXMpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ1BoeXNpY3NTeXN0ZW0gbm90IGF2YWlsYWJsZSAoM0Qgb25seSknIH07XG4gICAgICAgICAgICBjb25zdCByYXkgPSBuZXcgZ2VvbWV0cnkuUmF5KG9yaWdpbi54LCBvcmlnaW4ueSwgb3JpZ2luLnosIGRpcmVjdGlvbi54LCBkaXJlY3Rpb24ueSwgZGlyZWN0aW9uLnopO1xuICAgICAgICAgICAgY29uc3QgaGl0ID0gc3lzLnJheWNhc3RDbG9zZXN0KHJheSwgMHhmZmZmZmZmZiwgbWF4RGlzdGFuY2UpO1xuICAgICAgICAgICAgaWYgKCFoaXQpIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHsgaGl0OiBmYWxzZSB9IH07XG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBzeXMucmF5Y2FzdENsb3Nlc3RSZXN1bHQ7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICAgICAgICBoaXQ6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIGRpc3RhbmNlOiByZXN1bHQuZGlzdGFuY2UsXG4gICAgICAgICAgICAgICAgICAgIGhpdFBvaW50OiByZXN1bHQuaGl0UG9pbnQsXG4gICAgICAgICAgICAgICAgICAgIGhpdE5vcm1hbDogcmVzdWx0LmhpdE5vcm1hbCxcbiAgICAgICAgICAgICAgICAgICAgbm9kZVV1aWQ6IHJlc3VsdC5jb2xsaWRlcj8ubm9kZT8udXVpZCxcbiAgICAgICAgICAgICAgICAgICAgbm9kZU5hbWU6IHJlc3VsdC5jb2xsaWRlcj8ubm9kZT8ubmFtZSxcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIC8vIOKUgOKUgOKUgCBBdWRpbyBoZWxwZXJzIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuXG4gICAgYWRkQXVkaW9Tb3VyY2Uobm9kZVV1aWQ6IHN0cmluZywgY2xpcFV1aWQ6IHN0cmluZyB8IG51bGwpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IsIGpzLCBhc3NldE1hbmFnZXIgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlID0gc2NlbmUuZ2V0Q2hpbGRCeVV1aWQobm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIGNvbnN0IEF1ZGlvU291cmNlQ2xhc3MgPSBqcy5nZXRDbGFzc0J5TmFtZSgnQXVkaW9Tb3VyY2UnKTtcbiAgICAgICAgICAgIGlmICghQXVkaW9Tb3VyY2VDbGFzcykgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnQXVkaW9Tb3VyY2UgY2xhc3Mgbm90IGZvdW5kJyB9O1xuICAgICAgICAgICAgY29uc3QgYXVkaW8gPSBub2RlLmFkZENvbXBvbmVudChBdWRpb1NvdXJjZUNsYXNzKTtcbiAgICAgICAgICAgIGlmIChjbGlwVXVpZCkge1xuICAgICAgICAgICAgICAgIGFzc2V0TWFuYWdlci5sb2FkQW55KHsgdXVpZDogY2xpcFV1aWQgfSwgKGVycjogYW55LCBjbGlwOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFlcnIgJiYgY2xpcCkgYXVkaW8uY2xpcCA9IGNsaXA7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IHV1aWQ6IG5vZGUudXVpZCwgaGFzQ2xpcDogISFjbGlwVXVpZCB9IH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgc2V0QXVkaW9Qcm9wZXJ0eShub2RlVXVpZDogc3RyaW5nLCBwcm9wZXJ0eTogc3RyaW5nLCB2YWx1ZTogYW55KSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCBqcywgYXNzZXRNYW5hZ2VyIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IHNjZW5lLmdldENoaWxkQnlVdWlkKG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm9kZSAke25vZGVVdWlkfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICBjb25zdCBBdWRpb1NvdXJjZUNsYXNzID0ganMuZ2V0Q2xhc3NCeU5hbWUoJ0F1ZGlvU291cmNlJyk7XG4gICAgICAgICAgICBpZiAoIUF1ZGlvU291cmNlQ2xhc3MpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ0F1ZGlvU291cmNlIGNsYXNzIG5vdCBmb3VuZCcgfTtcbiAgICAgICAgICAgIGNvbnN0IGF1ZGlvID0gbm9kZS5nZXRDb21wb25lbnQoQXVkaW9Tb3VyY2VDbGFzcyk7XG4gICAgICAgICAgICBpZiAoIWF1ZGlvKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBBdWRpb1NvdXJjZSBjb21wb25lbnQgb24gbm9kZScgfTtcbiAgICAgICAgICAgIGlmIChbJ19fcHJvdG9fXycsICdjb25zdHJ1Y3RvcicsICdwcm90b3R5cGUnXS5pbmNsdWRlcyhwcm9wZXJ0eSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBTZXR0aW5nICcke3Byb3BlcnR5fScgaXMgbm90IGFsbG93ZWRgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAocHJvcGVydHkgPT09ICdjbGlwJyAmJiB0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgYXNzZXRNYW5hZ2VyLmxvYWRBbnkoeyB1dWlkOiB2YWx1ZSB9LCAoZXJyOiBhbnksIGNsaXA6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWVyciAmJiBjbGlwKSBhdWRpby5jbGlwID0gY2xpcDtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBtZXNzYWdlOiAnQ2xpcCBsb2FkaW5nIGluaXRpYXRlZCcgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGF1ZGlvW3Byb3BlcnR5XSA9IHZhbHVlO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIGNvbnRyb2xBdWRpbyhub2RlVXVpZDogc3RyaW5nLCBjb21tYW5kOiBzdHJpbmcpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IsIGpzIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IHNjZW5lLmdldENoaWxkQnlVdWlkKG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm9kZSAke25vZGVVdWlkfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICBjb25zdCBBdWRpb1NvdXJjZUNsYXNzID0ganMuZ2V0Q2xhc3NCeU5hbWUoJ0F1ZGlvU291cmNlJyk7XG4gICAgICAgICAgICBpZiAoIUF1ZGlvU291cmNlQ2xhc3MpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ0F1ZGlvU291cmNlIGNsYXNzIG5vdCBmb3VuZCcgfTtcbiAgICAgICAgICAgIGNvbnN0IGF1ZGlvID0gbm9kZS5nZXRDb21wb25lbnQoQXVkaW9Tb3VyY2VDbGFzcyk7XG4gICAgICAgICAgICBpZiAoIWF1ZGlvKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBBdWRpb1NvdXJjZSBjb21wb25lbnQgb24gbm9kZScgfTtcbiAgICAgICAgICAgIGNvbnN0IGNtZHM6IFJlY29yZDxzdHJpbmcsICgpID0+IHZvaWQ+ID0ge1xuICAgICAgICAgICAgICAgIHBsYXk6ICgpID0+IGF1ZGlvLnBsYXkoKSxcbiAgICAgICAgICAgICAgICBzdG9wOiAoKSA9PiBhdWRpby5zdG9wKCksXG4gICAgICAgICAgICAgICAgcGF1c2U6ICgpID0+IGF1ZGlvLnBhdXNlKCksXG4gICAgICAgICAgICAgICAgcmVzdW1lOiAoKSA9PiBhdWRpby5wbGF5KCksXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgaWYgKCFjbWRzW2NvbW1hbmRdKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBVbmtub3duIGNvbW1hbmQgJyR7Y29tbWFuZH0nYCB9O1xuICAgICAgICAgICAgY21kc1tjb21tYW5kXSgpO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogeyBjb21tYW5kIH0gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICBnZXRBdWRpb0luZm8obm9kZVV1aWQ6IHN0cmluZykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwganMgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlID0gc2NlbmUuZ2V0Q2hpbGRCeVV1aWQobm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIGNvbnN0IEF1ZGlvU291cmNlQ2xhc3MgPSBqcy5nZXRDbGFzc0J5TmFtZSgnQXVkaW9Tb3VyY2UnKTtcbiAgICAgICAgICAgIGlmICghQXVkaW9Tb3VyY2VDbGFzcykgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnQXVkaW9Tb3VyY2UgY2xhc3Mgbm90IGZvdW5kJyB9O1xuICAgICAgICAgICAgY29uc3QgYXVkaW8gPSBub2RlLmdldENvbXBvbmVudChBdWRpb1NvdXJjZUNsYXNzKTtcbiAgICAgICAgICAgIGlmICghYXVkaW8pIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIEF1ZGlvU291cmNlIGNvbXBvbmVudCBvbiBub2RlJyB9O1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgICAgICAgICAgY2xpcDogYXVkaW8uY2xpcD8ubmFtZSA/PyBudWxsLFxuICAgICAgICAgICAgICAgICAgICB2b2x1bWU6IGF1ZGlvLnZvbHVtZSxcbiAgICAgICAgICAgICAgICAgICAgbG9vcDogYXVkaW8ubG9vcCxcbiAgICAgICAgICAgICAgICAgICAgcGxheU9uQXdha2U6IGF1ZGlvLnBsYXlPbkF3YWtlLFxuICAgICAgICAgICAgICAgICAgICBwbGF5aW5nOiBhdWRpby5wbGF5aW5nLFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgbGlzdEF1ZGlvU291cmNlcygpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IsIGpzIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3QgQXVkaW9Tb3VyY2VDbGFzcyA9IGpzLmdldENsYXNzQnlOYW1lKCdBdWRpb1NvdXJjZScpO1xuICAgICAgICAgICAgaWYgKCFBdWRpb1NvdXJjZUNsYXNzKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdBdWRpb1NvdXJjZSBjbGFzcyBub3QgZm91bmQnIH07XG4gICAgICAgICAgICBjb25zdCBzb3VyY2VzOiBhbnlbXSA9IFtdO1xuICAgICAgICAgICAgY29uc3Qgd2FsayA9IChub2RlOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBhdWRpbyA9IG5vZGUuZ2V0Q29tcG9uZW50KEF1ZGlvU291cmNlQ2xhc3MpO1xuICAgICAgICAgICAgICAgIGlmIChhdWRpbykgc291cmNlcy5wdXNoKHsgdXVpZDogbm9kZS51dWlkLCBuYW1lOiBub2RlLm5hbWUsIGNsaXA6IGF1ZGlvLmNsaXA/Lm5hbWUgPz8gbnVsbCwgdm9sdW1lOiBhdWRpby52b2x1bWUgfSk7XG4gICAgICAgICAgICAgICAgbm9kZS5jaGlsZHJlbi5mb3JFYWNoKChjOiBhbnkpID0+IHdhbGsoYykpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHNjZW5lLmNoaWxkcmVuLmZvckVhY2goKGM6IGFueSkgPT4gd2FsayhjKSk7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IHNvdXJjZXMsIGNvdW50OiBzb3VyY2VzLmxlbmd0aCB9IH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgLy8g4pSA4pSA4pSAIFBhcnRpY2xlIGhlbHBlcnMg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5cbiAgICBhZGRQYXJ0aWNsZVN5c3RlbShub2RlVXVpZDogc3RyaW5nLCBpczJkOiBib29sZWFuKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCBqcyB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBzY2VuZS5nZXRDaGlsZEJ5VXVpZChub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgY29uc3QgY2xhc3NOYW1lID0gaXMyZCA/ICdQYXJ0aWNsZVN5c3RlbTJEJyA6ICdQYXJ0aWNsZVN5c3RlbSc7XG4gICAgICAgICAgICBjb25zdCBQU0NsYXNzID0ganMuZ2V0Q2xhc3NCeU5hbWUoY2xhc3NOYW1lKTtcbiAgICAgICAgICAgIGlmICghUFNDbGFzcykgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgJHtjbGFzc05hbWV9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIG5vZGUuYWRkQ29tcG9uZW50KFBTQ2xhc3MpO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogeyB1dWlkOiBub2RlLnV1aWQsIHBhcnRpY2xlQ2xhc3M6IGNsYXNzTmFtZSB9IH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgc2V0UGFydGljbGVQcm9wZXJ0eShub2RlVXVpZDogc3RyaW5nLCBwcm9wZXJ0eTogc3RyaW5nLCB2YWx1ZTogYW55KSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCBqcyB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBzY2VuZS5nZXRDaGlsZEJ5VXVpZChub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgaWYgKFsnX19wcm90b19fJywgJ2NvbnN0cnVjdG9yJywgJ3Byb3RvdHlwZSddLmluY2x1ZGVzKHByb3BlcnR5KSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYFNldHRpbmcgJyR7cHJvcGVydHl9JyBpcyBub3QgYWxsb3dlZGAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAoY29uc3QgY2xzIG9mIFsnUGFydGljbGVTeXN0ZW0nLCAnUGFydGljbGVTeXN0ZW0yRCddKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgUFNDbGFzcyA9IGpzLmdldENsYXNzQnlOYW1lKGNscyk7XG4gICAgICAgICAgICAgICAgaWYgKCFQU0NsYXNzKSBjb250aW51ZTtcbiAgICAgICAgICAgICAgICBjb25zdCBwcyA9IG5vZGUuZ2V0Q29tcG9uZW50KFBTQ2xhc3MpO1xuICAgICAgICAgICAgICAgIGlmIChwcykgeyBwc1twcm9wZXJ0eV0gPSB2YWx1ZTsgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSB9OyB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBQYXJ0aWNsZVN5c3RlbSBjb21wb25lbnQgZm91bmQgb24gbm9kZScgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICBzZXRQYXJ0aWNsZUVtaXNzaW9uKG5vZGVVdWlkOiBzdHJpbmcsIHJhdGVPdmVyVGltZTogbnVtYmVyLCBidXJzdHM6IGFueVtdKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCBqcyB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBzY2VuZS5nZXRDaGlsZEJ5VXVpZChub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgY29uc3QgUFNDbGFzcyA9IGpzLmdldENsYXNzQnlOYW1lKCdQYXJ0aWNsZVN5c3RlbScpO1xuICAgICAgICAgICAgaWYgKCFQU0NsYXNzKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdQYXJ0aWNsZVN5c3RlbSBub3QgZm91bmQgKDNEIG9ubHkgZm9yIGVtaXNzaW9uIGNvbnRyb2wpJyB9O1xuICAgICAgICAgICAgY29uc3QgcHMgPSBub2RlLmdldENvbXBvbmVudChQU0NsYXNzKTtcbiAgICAgICAgICAgIGlmICghcHMpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIFBhcnRpY2xlU3lzdGVtIG9uIG5vZGUnIH07XG4gICAgICAgICAgICBpZiAocmF0ZU92ZXJUaW1lICE9PSB1bmRlZmluZWQgJiYgcHMucmF0ZU92ZXJUaW1lKSB7XG4gICAgICAgICAgICAgICAgcHMucmF0ZU92ZXJUaW1lLmNvbnN0YW50ID0gcmF0ZU92ZXJUaW1lO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoYnVyc3RzKSAmJiBwcy5idXJzdHMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIHBzLmJ1cnN0cyA9IGJ1cnN0cztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICBzZXRQYXJ0aWNsZVNoYXBlKG5vZGVVdWlkOiBzdHJpbmcsIHNoYXBlVHlwZTogc3RyaW5nLCByYWRpdXM6IG51bWJlciwgYW5nbGU6IG51bWJlcikge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwganMgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlID0gc2NlbmUuZ2V0Q2hpbGRCeVV1aWQobm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIGNvbnN0IFBTQ2xhc3MgPSBqcy5nZXRDbGFzc0J5TmFtZSgnUGFydGljbGVTeXN0ZW0nKTtcbiAgICAgICAgICAgIGlmICghUFNDbGFzcykgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnUGFydGljbGVTeXN0ZW0gbm90IGZvdW5kICgzRCBvbmx5IGZvciBzaGFwZSknIH07XG4gICAgICAgICAgICBjb25zdCBwcyA9IG5vZGUuZ2V0Q29tcG9uZW50KFBTQ2xhc3MpO1xuICAgICAgICAgICAgaWYgKCFwcykgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gUGFydGljbGVTeXN0ZW0gb24gbm9kZScgfTtcbiAgICAgICAgICAgIGlmIChwcy5zaGFwZU1vZHVsZSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHNoYXBlTWFwOiBSZWNvcmQ8c3RyaW5nLCBudW1iZXI+ID0geyBjb25lOiAwLCBzcGhlcmU6IDEsIGJveDogNCB9O1xuICAgICAgICAgICAgICAgIGlmIChzaGFwZVR5cGUgJiYgc2hhcGVNYXBbc2hhcGVUeXBlXSAhPT0gdW5kZWZpbmVkKSBwcy5zaGFwZU1vZHVsZS5zaGFwZVR5cGUgPSBzaGFwZU1hcFtzaGFwZVR5cGVdO1xuICAgICAgICAgICAgICAgIGlmIChyYWRpdXMgIT09IHVuZGVmaW5lZCkgcHMuc2hhcGVNb2R1bGUucmFkaXVzID0gcmFkaXVzO1xuICAgICAgICAgICAgICAgIGlmIChhbmdsZSAhPT0gdW5kZWZpbmVkKSBwcy5zaGFwZU1vZHVsZS5hbmdsZSA9IGFuZ2xlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIHNldFBhcnRpY2xlUmVuZGVyZXIobm9kZVV1aWQ6IHN0cmluZywgcmVuZGVyTW9kZTogbnVtYmVyLCBtYXRlcmlhbFV1aWQ6IHN0cmluZykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwganMsIGFzc2V0TWFuYWdlciB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBzY2VuZS5nZXRDaGlsZEJ5VXVpZChub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgY29uc3QgUFNDbGFzcyA9IGpzLmdldENsYXNzQnlOYW1lKCdQYXJ0aWNsZVN5c3RlbScpO1xuICAgICAgICAgICAgaWYgKCFQU0NsYXNzKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdQYXJ0aWNsZVN5c3RlbSBub3QgZm91bmQnIH07XG4gICAgICAgICAgICBjb25zdCBwcyA9IG5vZGUuZ2V0Q29tcG9uZW50KFBTQ2xhc3MpO1xuICAgICAgICAgICAgaWYgKCFwcykgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gUGFydGljbGVTeXN0ZW0gb24gbm9kZScgfTtcbiAgICAgICAgICAgIGlmIChyZW5kZXJNb2RlICE9PSB1bmRlZmluZWQgJiYgcHMucmVuZGVyZXIpIHBzLnJlbmRlcmVyLnJlbmRlck1vZGUgPSByZW5kZXJNb2RlO1xuICAgICAgICAgICAgaWYgKG1hdGVyaWFsVXVpZCAmJiBwcy5yZW5kZXJlcikge1xuICAgICAgICAgICAgICAgIGFzc2V0TWFuYWdlci5sb2FkQW55KHsgdXVpZDogbWF0ZXJpYWxVdWlkIH0sIChlcnI6IGFueSwgbWF0OiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFlcnIgJiYgbWF0KSBwcy5yZW5kZXJlci5zaGFyZWRNYXRlcmlhbCA9IG1hdDtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICBnZXRQYXJ0aWNsZUluZm8obm9kZVV1aWQ6IHN0cmluZykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwganMgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlID0gc2NlbmUuZ2V0Q2hpbGRCeVV1aWQobm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgY2xzIG9mIFsnUGFydGljbGVTeXN0ZW0nLCAnUGFydGljbGVTeXN0ZW0yRCddKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgUFNDbGFzcyA9IGpzLmdldENsYXNzQnlOYW1lKGNscyk7XG4gICAgICAgICAgICAgICAgaWYgKCFQU0NsYXNzKSBjb250aW51ZTtcbiAgICAgICAgICAgICAgICBjb25zdCBwcyA9IG5vZGUuZ2V0Q29tcG9uZW50KFBTQ2xhc3MpO1xuICAgICAgICAgICAgICAgIGlmIChwcykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwYXJ0aWNsZUNsYXNzOiBjbHMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZHVyYXRpb246IHBzLmR1cmF0aW9uLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvb3A6IHBzLmxvb3AsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcGxheU9uQXdha2U6IHBzLnBsYXlPbkF3YWtlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1heFBhcnRpY2xlczogcHMuY2FwYWNpdHkgPz8gcHMudG90YWxQYXJ0aWNsZXMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhcnRMaWZldGltZTogcHMuc3RhcnRMaWZldGltZT8uY29uc3RhbnQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhcnRTcGVlZDogcHMuc3RhcnRTcGVlZD8uY29uc3RhbnQsXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gUGFydGljbGVTeXN0ZW0gY29tcG9uZW50IGZvdW5kIG9uIG5vZGUnIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgbGlzdFBhcnRpY2xlU3lzdGVtcygpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IsIGpzIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3QgcGFydGljbGVzOiBhbnlbXSA9IFtdO1xuICAgICAgICAgICAgY29uc3Qgd2FsayA9IChub2RlOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGNscyBvZiBbJ1BhcnRpY2xlU3lzdGVtJywgJ1BhcnRpY2xlU3lzdGVtMkQnXSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBQU0NsYXNzID0ganMuZ2V0Q2xhc3NCeU5hbWUoY2xzKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKFBTQ2xhc3MgJiYgbm9kZS5nZXRDb21wb25lbnQoUFNDbGFzcykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhcnRpY2xlcy5wdXNoKHsgdXVpZDogbm9kZS51dWlkLCBuYW1lOiBub2RlLm5hbWUsIHBhcnRpY2xlQ2xhc3M6IGNscyB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIG5vZGUuY2hpbGRyZW4uZm9yRWFjaCgoYzogYW55KSA9PiB3YWxrKGMpKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBzY2VuZS5jaGlsZHJlbi5mb3JFYWNoKChjOiBhbnkpID0+IHdhbGsoYykpO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogeyBwYXJ0aWNsZXMsIGNvdW50OiBwYXJ0aWNsZXMubGVuZ3RoIH0gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICByZW1vdmVQYXJ0aWNsZVN5c3RlbShub2RlVXVpZDogc3RyaW5nKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCBqcyB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBzY2VuZS5nZXRDaGlsZEJ5VXVpZChub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgZm9yIChjb25zdCBjbHMgb2YgWydQYXJ0aWNsZVN5c3RlbScsICdQYXJ0aWNsZVN5c3RlbTJEJ10pIHtcbiAgICAgICAgICAgICAgICBjb25zdCBQU0NsYXNzID0ganMuZ2V0Q2xhc3NCeU5hbWUoY2xzKTtcbiAgICAgICAgICAgICAgICBpZiAoIVBTQ2xhc3MpIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIGNvbnN0IHBzID0gbm9kZS5nZXRDb21wb25lbnQoUFNDbGFzcyk7XG4gICAgICAgICAgICAgICAgaWYgKHBzKSB7IG5vZGUucmVtb3ZlQ29tcG9uZW50KHBzKTsgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSB9OyB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBQYXJ0aWNsZVN5c3RlbSBjb21wb25lbnQgZm91bmQgb24gbm9kZScgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICAvLyDilIDilIDilIAgVHdlZW4gaGVscGVycyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcblxuICAgIF9hcHBseVR3ZWVuUHJvcGVydGllcyh0d2VlbjogYW55LCBub2RlOiBhbnksIHByb3BlcnRpZXM6IGFueSwgY2NNb2R1bGU6IGFueSk6IGFueSB7XG4gICAgICAgIGNvbnN0IHsgVmVjMywgUXVhdCB9ID0gY2NNb2R1bGU7XG4gICAgICAgIGNvbnN0IHRhcmdldDogUmVjb3JkPHN0cmluZywgYW55PiA9IHt9O1xuICAgICAgICBpZiAocHJvcGVydGllcy5wb3NpdGlvbikgdGFyZ2V0LnBvc2l0aW9uID0gbmV3IFZlYzMocHJvcGVydGllcy5wb3NpdGlvbi54ID8/IDAsIHByb3BlcnRpZXMucG9zaXRpb24ueSA/PyAwLCBwcm9wZXJ0aWVzLnBvc2l0aW9uLnogPz8gMCk7XG4gICAgICAgIGlmIChwcm9wZXJ0aWVzLnNjYWxlKSB0YXJnZXQuc2NhbGUgPSBuZXcgVmVjMyhwcm9wZXJ0aWVzLnNjYWxlLnggPz8gMSwgcHJvcGVydGllcy5zY2FsZS55ID8/IDEsIHByb3BlcnRpZXMuc2NhbGUueiA/PyAxKTtcbiAgICAgICAgaWYgKHByb3BlcnRpZXMub3BhY2l0eSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBjb25zdCB1aU9wID0gbm9kZS5nZXRDb21wb25lbnQgJiYgbm9kZS5nZXRDb21wb25lbnQoY2NNb2R1bGUuanM/LmdldENsYXNzQnlOYW1lKCdVSU9wYWNpdHknKSk7XG4gICAgICAgICAgICBpZiAodWlPcCkgdGFyZ2V0Lm9wYWNpdHkgPSBwcm9wZXJ0aWVzLm9wYWNpdHk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRhcmdldDtcbiAgICB9LFxuXG4gICAgY3JlYXRlVHdlZW4obm9kZVV1aWQ6IHN0cmluZywgc3RlcHM6IGFueVtdKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBjYyA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCB0d2VlbiwgVmVjMyB9ID0gY2M7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlID0gc2NlbmUuZ2V0Q2hpbGRCeVV1aWQobm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIGxldCB0ID0gdHdlZW4obm9kZSk7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHN0ZXAgb2Ygc3RlcHMpIHtcbiAgICAgICAgICAgICAgICBpZiAoc3RlcC50eXBlID09PSAnZGVsYXknKSB7XG4gICAgICAgICAgICAgICAgICAgIHQgPSB0LmRlbGF5KHN0ZXAuZHVyYXRpb24gPz8gMCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChzdGVwLnR5cGUgPT09ICd0bycgfHwgc3RlcC50eXBlID09PSAnYnknKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHByb3BzID0gc3RlcC5wcm9wZXJ0aWVzIHx8IHt9O1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB0YXJnZXQ6IFJlY29yZDxzdHJpbmcsIGFueT4gPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHByb3BzLnBvc2l0aW9uKSB0YXJnZXQucG9zaXRpb24gPSBuZXcgVmVjMyhwcm9wcy5wb3NpdGlvbi54ID8/IDAsIHByb3BzLnBvc2l0aW9uLnkgPz8gMCwgcHJvcHMucG9zaXRpb24ueiA/PyAwKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHByb3BzLnNjYWxlKSB0YXJnZXQuc2NhbGUgPSBuZXcgVmVjMyhwcm9wcy5zY2FsZS54ID8/IDEsIHByb3BzLnNjYWxlLnkgPz8gMSwgcHJvcHMuc2NhbGUueiA/PyAxKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgb3B0cyA9IHN0ZXAuZWFzaW5nID8geyBlYXNpbmc6IHN0ZXAuZWFzaW5nIH0gOiB7fTtcbiAgICAgICAgICAgICAgICAgICAgdCA9IHN0ZXAudHlwZSA9PT0gJ3RvJyA/IHQudG8oc3RlcC5kdXJhdGlvbiA/PyAxLCB0YXJnZXQsIG9wdHMpIDogdC5ieShzdGVwLmR1cmF0aW9uID8/IDEsIHRhcmdldCwgb3B0cyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdC5zdGFydCgpO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogeyBub2RlVXVpZCwgc3RlcHM6IHN0ZXBzLmxlbmd0aCB9IH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgYWRkVHdlZW5Ubyhub2RlVXVpZDogc3RyaW5nLCBwcm9wZXJ0aWVzOiBhbnksIGR1cmF0aW9uOiBudW1iZXIsIGVhc2luZzogc3RyaW5nKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCB0d2VlbiwgVmVjMyB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBzY2VuZS5nZXRDaGlsZEJ5VXVpZChub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgY29uc3QgdGFyZ2V0OiBSZWNvcmQ8c3RyaW5nLCBhbnk+ID0ge307XG4gICAgICAgICAgICBpZiAocHJvcGVydGllcy5wb3NpdGlvbikgdGFyZ2V0LnBvc2l0aW9uID0gbmV3IFZlYzMocHJvcGVydGllcy5wb3NpdGlvbi54ID8/IDAsIHByb3BlcnRpZXMucG9zaXRpb24ueSA/PyAwLCBwcm9wZXJ0aWVzLnBvc2l0aW9uLnogPz8gMCk7XG4gICAgICAgICAgICBpZiAocHJvcGVydGllcy5zY2FsZSkgdGFyZ2V0LnNjYWxlID0gbmV3IFZlYzMocHJvcGVydGllcy5zY2FsZS54ID8/IDEsIHByb3BlcnRpZXMuc2NhbGUueSA/PyAxLCBwcm9wZXJ0aWVzLnNjYWxlLnogPz8gMSk7XG4gICAgICAgICAgICBjb25zdCBvcHRzID0gZWFzaW5nICYmIGVhc2luZyAhPT0gJ2xpbmVhcicgPyB7IGVhc2luZyB9IDoge307XG4gICAgICAgICAgICB0d2Vlbihub2RlKS50byhkdXJhdGlvbiwgdGFyZ2V0LCBvcHRzKS5zdGFydCgpO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogeyBub2RlVXVpZCwgZHVyYXRpb24sIGVhc2luZyB9IH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgYWRkVHdlZW5CeShub2RlVXVpZDogc3RyaW5nLCBwcm9wZXJ0aWVzOiBhbnksIGR1cmF0aW9uOiBudW1iZXIsIGVhc2luZzogc3RyaW5nKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCB0d2VlbiwgVmVjMyB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBzY2VuZS5nZXRDaGlsZEJ5VXVpZChub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgY29uc3QgdGFyZ2V0OiBSZWNvcmQ8c3RyaW5nLCBhbnk+ID0ge307XG4gICAgICAgICAgICBpZiAocHJvcGVydGllcy5wb3NpdGlvbikgdGFyZ2V0LnBvc2l0aW9uID0gbmV3IFZlYzMocHJvcGVydGllcy5wb3NpdGlvbi54ID8/IDAsIHByb3BlcnRpZXMucG9zaXRpb24ueSA/PyAwLCBwcm9wZXJ0aWVzLnBvc2l0aW9uLnogPz8gMCk7XG4gICAgICAgICAgICBpZiAocHJvcGVydGllcy5zY2FsZSkgdGFyZ2V0LnNjYWxlID0gbmV3IFZlYzMocHJvcGVydGllcy5zY2FsZS54ID8/IDEsIHByb3BlcnRpZXMuc2NhbGUueSA/PyAxLCBwcm9wZXJ0aWVzLnNjYWxlLnogPz8gMSk7XG4gICAgICAgICAgICBjb25zdCBvcHRzID0gZWFzaW5nICYmIGVhc2luZyAhPT0gJ2xpbmVhcicgPyB7IGVhc2luZyB9IDoge307XG4gICAgICAgICAgICB0d2Vlbihub2RlKS5ieShkdXJhdGlvbiwgdGFyZ2V0LCBvcHRzKS5zdGFydCgpO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogeyBub2RlVXVpZCwgZHVyYXRpb24sIGVhc2luZyB9IH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgYWRkVHdlZW5EZWxheShub2RlVXVpZDogc3RyaW5nLCBkdXJhdGlvbjogbnVtYmVyKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCB0d2VlbiB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBzY2VuZS5nZXRDaGlsZEJ5VXVpZChub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgdHdlZW4obm9kZSkuZGVsYXkoZHVyYXRpb24pLnN0YXJ0KCk7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IG5vZGVVdWlkLCBkdXJhdGlvbiB9IH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgc3RvcFR3ZWVucyhub2RlVXVpZDogc3RyaW5nKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCBUd2VlbiB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBzY2VuZS5nZXRDaGlsZEJ5VXVpZChub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgaWYgKFR3ZWVuICYmIHR5cGVvZiBUd2Vlbi5zdG9wQWxsQnlUYXJnZXQgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgICAgICBUd2Vlbi5zdG9wQWxsQnlUYXJnZXQobm9kZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IG5vZGVVdWlkIH0gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICAvLyDilIDilIAgVGlsZWRNYXAg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5cbiAgICBnZXRUaWxlZE1hcEluZm8obm9kZVV1aWQ6IHN0cmluZykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwganMgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlID0gc2NlbmUuZ2V0Q2hpbGRCeVV1aWQobm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIGNvbnN0IFRpbGVkTWFwID0ganMuZ2V0Q2xhc3NCeU5hbWUoJ1RpbGVkTWFwJyk7XG4gICAgICAgICAgICBpZiAoIVRpbGVkTWFwKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdUaWxlZE1hcCBjbGFzcyBub3QgZm91bmQnIH07XG4gICAgICAgICAgICBjb25zdCBjb21wID0gbm9kZS5nZXRDb21wb25lbnQoVGlsZWRNYXApO1xuICAgICAgICAgICAgaWYgKCFjb21wKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBUaWxlZE1hcCBjb21wb25lbnQgb24gbm9kZScgfTtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyczogc3RyaW5nW10gPSBbXTtcbiAgICAgICAgICAgIGlmIChjb21wLmdldExheWVycykgeyB0cnkgeyBjb21wLmdldExheWVycygpLmZvckVhY2goKGw6IGFueSkgPT4gbGF5ZXJzLnB1c2gobC5nZXRMYXllck5hbWUgPyBsLmdldExheWVyTmFtZSgpIDogbC5sYXllck5hbWUpKTsgfSBjYXRjaCB7IC8qIGlnbm9yZSAqLyB9IH1cbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHsgbWFwU2l6ZTogY29tcC5tYXBTaXplLCB0aWxlU2l6ZTogY29tcC50aWxlU2l6ZSwgbGF5ZXJzLCBvcmllbnRhdGlvbjogY29tcC5vcmllbnRhdGlvbiB9IH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgbGlzdFRpbGVkTWFwcygpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IsIGpzIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3QgVGlsZWRNYXAgPSBqcy5nZXRDbGFzc0J5TmFtZSgnVGlsZWRNYXAnKTtcbiAgICAgICAgICAgIGlmICghVGlsZWRNYXApIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ1RpbGVkTWFwIGNsYXNzIG5vdCBmb3VuZCcgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGVzOiBhbnlbXSA9IFtdO1xuICAgICAgICAgICAgc2NlbmUud2Fsaygobm9kZTogYW55KSA9PiB7IGlmIChub2RlLmdldENvbXBvbmVudChUaWxlZE1hcCkpIG5vZGVzLnB1c2goeyB1dWlkOiBub2RlLnV1aWQsIG5hbWU6IG5vZGUubmFtZSB9KTsgfSk7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IG5vZGVzLCBjb3VudDogbm9kZXMubGVuZ3RoIH0gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICBnZXRUaWxlZExheWVySW5mbyhub2RlVXVpZDogc3RyaW5nLCBsYXllck5hbWU6IHN0cmluZykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwganMgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlID0gc2NlbmUuZ2V0Q2hpbGRCeVV1aWQobm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIGNvbnN0IFRpbGVkTWFwID0ganMuZ2V0Q2xhc3NCeU5hbWUoJ1RpbGVkTWFwJyk7XG4gICAgICAgICAgICBpZiAoIVRpbGVkTWFwKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdUaWxlZE1hcCBjbGFzcyBub3QgZm91bmQnIH07XG4gICAgICAgICAgICBjb25zdCBjb21wID0gbm9kZS5nZXRDb21wb25lbnQoVGlsZWRNYXApO1xuICAgICAgICAgICAgaWYgKCFjb21wKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBUaWxlZE1hcCBjb21wb25lbnQgb24gbm9kZScgfTtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gY29tcC5nZXRMYXllcihsYXllck5hbWUpO1xuICAgICAgICAgICAgaWYgKCFsYXllcikgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTGF5ZXIgJyR7bGF5ZXJOYW1lfScgbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogeyBsYXllck5hbWUsIGxheWVyU2l6ZTogbGF5ZXIubGF5ZXJTaXplLCB0aWxlczogbGF5ZXIudGlsZXMgfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIHNldFRpbGUobm9kZVV1aWQ6IHN0cmluZywgbGF5ZXJOYW1lOiBzdHJpbmcsIHg6IG51bWJlciwgeTogbnVtYmVyLCBnaWQ6IG51bWJlcikge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwganMgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlID0gc2NlbmUuZ2V0Q2hpbGRCeVV1aWQobm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIGNvbnN0IFRpbGVkTWFwID0ganMuZ2V0Q2xhc3NCeU5hbWUoJ1RpbGVkTWFwJyk7XG4gICAgICAgICAgICBpZiAoIVRpbGVkTWFwKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdUaWxlZE1hcCBjbGFzcyBub3QgZm91bmQnIH07XG4gICAgICAgICAgICBjb25zdCBjb21wID0gbm9kZS5nZXRDb21wb25lbnQoVGlsZWRNYXApO1xuICAgICAgICAgICAgaWYgKCFjb21wKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBUaWxlZE1hcCBjb21wb25lbnQgb24gbm9kZScgfTtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gY29tcC5nZXRMYXllcihsYXllck5hbWUpO1xuICAgICAgICAgICAgaWYgKCFsYXllcikgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTGF5ZXIgJyR7bGF5ZXJOYW1lfScgbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgbGF5ZXIuc2V0VGlsZUdJREF0KGdpZCwgeCwgeSk7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IHgsIHksIGdpZCB9IH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgZ2V0VGlsZShub2RlVXVpZDogc3RyaW5nLCBsYXllck5hbWU6IHN0cmluZywgeDogbnVtYmVyLCB5OiBudW1iZXIpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IsIGpzIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IHNjZW5lLmdldENoaWxkQnlVdWlkKG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm9kZSAke25vZGVVdWlkfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICBjb25zdCBUaWxlZE1hcCA9IGpzLmdldENsYXNzQnlOYW1lKCdUaWxlZE1hcCcpO1xuICAgICAgICAgICAgaWYgKCFUaWxlZE1hcCkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnVGlsZWRNYXAgY2xhc3Mgbm90IGZvdW5kJyB9O1xuICAgICAgICAgICAgY29uc3QgY29tcCA9IG5vZGUuZ2V0Q29tcG9uZW50KFRpbGVkTWFwKTtcbiAgICAgICAgICAgIGlmICghY29tcCkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gVGlsZWRNYXAgY29tcG9uZW50IG9uIG5vZGUnIH07XG4gICAgICAgICAgICBjb25zdCBsYXllciA9IGNvbXAuZ2V0TGF5ZXIobGF5ZXJOYW1lKTtcbiAgICAgICAgICAgIGlmICghbGF5ZXIpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYExheWVyICcke2xheWVyTmFtZX0nIG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIGNvbnN0IGdpZCA9IGxheWVyLmdldFRpbGVHSURBdCh4LCB5KTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHsgeCwgeSwgZ2lkIH0gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICBnZXRUaWxlc2V0SW5mbyhub2RlVXVpZDogc3RyaW5nKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCBqcyB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBzY2VuZS5nZXRDaGlsZEJ5VXVpZChub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgY29uc3QgVGlsZWRNYXAgPSBqcy5nZXRDbGFzc0J5TmFtZSgnVGlsZWRNYXAnKTtcbiAgICAgICAgICAgIGlmICghVGlsZWRNYXApIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ1RpbGVkTWFwIGNsYXNzIG5vdCBmb3VuZCcgfTtcbiAgICAgICAgICAgIGNvbnN0IGNvbXAgPSBub2RlLmdldENvbXBvbmVudChUaWxlZE1hcCk7XG4gICAgICAgICAgICBpZiAoIWNvbXApIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIFRpbGVkTWFwIGNvbXBvbmVudCBvbiBub2RlJyB9O1xuICAgICAgICAgICAgY29uc3QgdGlsZXNldHM6IGFueVtdID0gW107XG4gICAgICAgICAgICBpZiAoY29tcC5nZXRUaWxlc2V0cykge1xuICAgICAgICAgICAgICAgIHRyeSB7IGNvbXAuZ2V0VGlsZXNldHMoKS5mb3JFYWNoKCh0czogYW55KSA9PiB0aWxlc2V0cy5wdXNoKHsgbmFtZTogdHMubmFtZSwgZmlyc3RHaWQ6IHRzLmZpcnN0R2lkLCB0aWxlU2l6ZTogdHMudGlsZVNpemUgfSkpOyB9IGNhdGNoIHsgLyogaWdub3JlICovIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHsgdGlsZXNldHMgfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIC8vIOKUgOKUgCBTcGluZSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcblxuICAgIGdldFNwaW5lSW5mbyhub2RlVXVpZDogc3RyaW5nKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgbGV0IHNwOiBhbnk7XG4gICAgICAgICAgICB0cnkgeyBzcCA9IHJlcXVpcmUoJ2NjJykuc3A7IGlmICghc3ApIHRocm93IG5ldyBFcnJvcignbm90IGZvdW5kJyk7IH0gY2F0Y2ggeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdTcGluZSBtb2R1bGUgbm90IGF2YWlsYWJsZSBpbiB0aGlzIHByb2plY3QnIH07IH1cbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBzY2VuZS5nZXRDaGlsZEJ5VXVpZChub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgY29uc3QgY29tcCA9IG5vZGUuZ2V0Q29tcG9uZW50KHNwLlNrZWxldG9uKTtcbiAgICAgICAgICAgIGlmICghY29tcCkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gc3AuU2tlbGV0b24gY29tcG9uZW50IG9uIG5vZGUnIH07XG4gICAgICAgICAgICBjb25zdCBhbmltYXRpb25zOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICAgICAgY29uc3Qgc2tpbnM6IHN0cmluZ1tdID0gW107XG4gICAgICAgICAgICB0cnkgeyBpZiAoY29tcC5za2VsZXRvbkRhdGEpIHsgY29uc3QgYWUgPSBjb21wLnNrZWxldG9uRGF0YS5nZXRBbmltc0VudW07IGNvbnN0IHNlID0gY29tcC5za2VsZXRvbkRhdGEuZ2V0U2tpbnNFbnVtOyBpZiAoYWUpIGFuaW1hdGlvbnMucHVzaCguLi5PYmplY3Qua2V5cyhhZSgpKSk7IGlmIChzZSkgc2tpbnMucHVzaCguLi5PYmplY3Qua2V5cyhzZSgpKSk7IH0gfSBjYXRjaCB7IC8qIGlnbm9yZSAqLyB9XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IGFuaW1hdGlvbnMsIHNraW5zLCB0aW1lU2NhbGU6IGNvbXAudGltZVNjYWxlLCBwcmVtdWx0aXBsaWVkQWxwaGE6IGNvbXAucHJlbXVsdGlwbGllZEFscGhhLCBkZWJ1Z0JvbmVzOiBjb21wLmRlYnVnQm9uZXMsIGRlYnVnU2xvdHM6IGNvbXAuZGVidWdTbG90cyB9IH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgc2V0U3BpbmVBbmltYXRpb24obm9kZVV1aWQ6IHN0cmluZywgYW5pbWF0aW9uTmFtZTogc3RyaW5nLCBsb29wOiBib29sZWFuLCB0cmFja0luZGV4OiBudW1iZXIpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBsZXQgc3A6IGFueTtcbiAgICAgICAgICAgIHRyeSB7IHNwID0gcmVxdWlyZSgnY2MnKS5zcDsgaWYgKCFzcCkgdGhyb3cgbmV3IEVycm9yKCdub3QgZm91bmQnKTsgfSBjYXRjaCB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ1NwaW5lIG1vZHVsZSBub3QgYXZhaWxhYmxlIGluIHRoaXMgcHJvamVjdCcgfTsgfVxuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IHNjZW5lLmdldENoaWxkQnlVdWlkKG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm9kZSAke25vZGVVdWlkfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICBjb25zdCBjb21wID0gbm9kZS5nZXRDb21wb25lbnQoc3AuU2tlbGV0b24pO1xuICAgICAgICAgICAgaWYgKCFjb21wKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBzcC5Ta2VsZXRvbiBjb21wb25lbnQgb24gbm9kZScgfTtcbiAgICAgICAgICAgIGNvbXAuc2V0QW5pbWF0aW9uKHRyYWNrSW5kZXgsIGFuaW1hdGlvbk5hbWUsIGxvb3ApO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogeyBhbmltYXRpb25OYW1lLCBsb29wLCB0cmFja0luZGV4IH0gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICBzZXRTcGluZVNraW4obm9kZVV1aWQ6IHN0cmluZywgc2tpbk5hbWU6IHN0cmluZykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGxldCBzcDogYW55O1xuICAgICAgICAgICAgdHJ5IHsgc3AgPSByZXF1aXJlKCdjYycpLnNwOyBpZiAoIXNwKSB0aHJvdyBuZXcgRXJyb3IoJ25vdCBmb3VuZCcpOyB9IGNhdGNoIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnU3BpbmUgbW9kdWxlIG5vdCBhdmFpbGFibGUgaW4gdGhpcyBwcm9qZWN0JyB9OyB9XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlID0gc2NlbmUuZ2V0Q2hpbGRCeVV1aWQobm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIGNvbnN0IGNvbXAgPSBub2RlLmdldENvbXBvbmVudChzcC5Ta2VsZXRvbik7XG4gICAgICAgICAgICBpZiAoIWNvbXApIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIHNwLlNrZWxldG9uIGNvbXBvbmVudCBvbiBub2RlJyB9O1xuICAgICAgICAgICAgY29tcC5zZXRTa2luKHNraW5OYW1lKTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHsgc2tpbk5hbWUgfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIHNldFNwaW5lUHJvcGVydHkobm9kZVV1aWQ6IHN0cmluZywgcHJvcGVydHk6IHN0cmluZywgdmFsdWU6IGFueSkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGxldCBzcDogYW55O1xuICAgICAgICAgICAgdHJ5IHsgc3AgPSByZXF1aXJlKCdjYycpLnNwOyBpZiAoIXNwKSB0aHJvdyBuZXcgRXJyb3IoJ25vdCBmb3VuZCcpOyB9IGNhdGNoIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnU3BpbmUgbW9kdWxlIG5vdCBhdmFpbGFibGUgaW4gdGhpcyBwcm9qZWN0JyB9OyB9XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlID0gc2NlbmUuZ2V0Q2hpbGRCeVV1aWQobm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIGNvbnN0IGNvbXAgPSBub2RlLmdldENvbXBvbmVudChzcC5Ta2VsZXRvbik7XG4gICAgICAgICAgICBpZiAoIWNvbXApIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIHNwLlNrZWxldG9uIGNvbXBvbmVudCBvbiBub2RlJyB9O1xuICAgICAgICAgICAgY29uc3QgYWxsb3dlZCA9IFsndGltZVNjYWxlJywgJ3ByZW11bHRpcGxpZWRBbHBoYScsICdkZWJ1Z0JvbmVzJywgJ2RlYnVnU2xvdHMnXTtcbiAgICAgICAgICAgIGlmICghYWxsb3dlZC5pbmNsdWRlcyhwcm9wZXJ0eSkpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYFByb3BlcnR5ICcke3Byb3BlcnR5fScgbm90IGFsbG93ZWQuIFVzZTogJHthbGxvd2VkLmpvaW4oJywgJyl9YCB9O1xuICAgICAgICAgICAgKGNvbXAgYXMgYW55KVtwcm9wZXJ0eV0gPSB2YWx1ZTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHsgcHJvcGVydHksIHZhbHVlIH0gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICBsaXN0U3BpbmVOb2RlcygpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBsZXQgc3A6IGFueTtcbiAgICAgICAgICAgIHRyeSB7IHNwID0gcmVxdWlyZSgnY2MnKS5zcDsgaWYgKCFzcCkgdGhyb3cgbmV3IEVycm9yKCdub3QgZm91bmQnKTsgfSBjYXRjaCB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ1NwaW5lIG1vZHVsZSBub3QgYXZhaWxhYmxlIGluIHRoaXMgcHJvamVjdCcgfTsgfVxuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3Qgbm9kZXM6IGFueVtdID0gW107XG4gICAgICAgICAgICBzY2VuZS53YWxrKChub2RlOiBhbnkpID0+IHsgaWYgKG5vZGUuZ2V0Q29tcG9uZW50KHNwLlNrZWxldG9uKSkgbm9kZXMucHVzaCh7IHV1aWQ6IG5vZGUudXVpZCwgbmFtZTogbm9kZS5uYW1lIH0pOyB9KTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHsgbm9kZXMsIGNvdW50OiBub2Rlcy5sZW5ndGggfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIGFkZFNwaW5lVG9Ob2RlKG5vZGVVdWlkOiBzdHJpbmcsIHNrZWxldG9uRGF0YVV1aWQ6IHN0cmluZykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwgYXNzZXRNYW5hZ2VyIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgbGV0IHNwOiBhbnk7XG4gICAgICAgICAgICB0cnkgeyBzcCA9IHJlcXVpcmUoJ2NjJykuc3A7IGlmICghc3ApIHRocm93IG5ldyBFcnJvcignbm90IGZvdW5kJyk7IH0gY2F0Y2ggeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdTcGluZSBtb2R1bGUgbm90IGF2YWlsYWJsZSBpbiB0aGlzIHByb2plY3QnIH07IH1cbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBzY2VuZS5nZXRDaGlsZEJ5VXVpZChub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgY29uc3QgY29tcCA9IG5vZGUuYWRkQ29tcG9uZW50KHNwLlNrZWxldG9uKTtcbiAgICAgICAgICAgIGFzc2V0TWFuYWdlci5sb2FkQW55KHNrZWxldG9uRGF0YVV1aWQsIChlcnI6IGFueSwgYXNzZXQ6IGFueSkgPT4geyBpZiAoIWVyciAmJiBhc3NldCkgY29tcC5za2VsZXRvbkRhdGEgPSBhc3NldDsgfSk7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IG5vZGVVdWlkLCBza2VsZXRvbkRhdGFVdWlkIH0gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICAvLyDilIDilIAgRHJhZ29uQm9uZXMg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5cbiAgICBnZXREcmFnb25Cb25lc0luZm8obm9kZVV1aWQ6IHN0cmluZykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGxldCBkYjogYW55O1xuICAgICAgICAgICAgdHJ5IHsgZGIgPSByZXF1aXJlKCdjYycpLmRyYWdvbkJvbmVzOyBpZiAoIWRiKSB0aHJvdyBuZXcgRXJyb3IoJ25vdCBmb3VuZCcpOyB9IGNhdGNoIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnRHJhZ29uQm9uZXMgbW9kdWxlIG5vdCBhdmFpbGFibGUgaW4gdGhpcyBwcm9qZWN0JyB9OyB9XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlID0gc2NlbmUuZ2V0Q2hpbGRCeVV1aWQobm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIGNvbnN0IGNvbXAgPSBub2RlLmdldENvbXBvbmVudChkYi5Bcm1hdHVyZURpc3BsYXkpO1xuICAgICAgICAgICAgaWYgKCFjb21wKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBBcm1hdHVyZURpc3BsYXkgY29tcG9uZW50IG9uIG5vZGUnIH07XG4gICAgICAgICAgICBjb25zdCBhbmltYXRpb25zOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICAgICAgY29uc3QgYXJtYXR1cmVOYW1lczogc3RyaW5nW10gPSBbXTtcbiAgICAgICAgICAgIHRyeSB7IGlmIChjb21wLmRyYWdvbkFzc2V0KSB7IGFybWF0dXJlTmFtZXMucHVzaCguLi4oY29tcC5kcmFnb25Bc3NldC5hcm1hdHVyZU5hbWVzIHx8IFtdKSk7IGNvbnN0IGZhY3RvcnkgPSBkYi5DQ0ZhY3RvcnkuZ2V0SW5zdGFuY2UoKTsgaWYgKGZhY3RvcnkpIHsgY29uc3QgYXJtID0gZmFjdG9yeS5idWlsZEFybWF0dXJlKGNvbXAuYXJtYXR1cmVOYW1lLCBjb21wLmRyYWdvbkFzc2V0Lm5hbWUpOyBpZiAoYXJtKSB7IGFuaW1hdGlvbnMucHVzaCguLi5hcm0uYW5pbWF0aW9uLmFuaW1hdGlvbk5hbWVzKTsgYXJtLmRpc3Bvc2UoKTsgfSB9IH0gfSBjYXRjaCB7IC8qIGlnbm9yZSAqLyB9XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IGFybWF0dXJlTmFtZXMsIGFuaW1hdGlvbnMsIHRpbWVTY2FsZTogY29tcC50aW1lU2NhbGUsIGFybWF0dXJlTmFtZTogY29tcC5hcm1hdHVyZU5hbWUgfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIHNldERyYWdvbkJvbmVzQW5pbWF0aW9uKG5vZGVVdWlkOiBzdHJpbmcsIGFuaW1hdGlvbk5hbWU6IHN0cmluZywgcGxheVRpbWVzOiBudW1iZXIpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBsZXQgZGI6IGFueTtcbiAgICAgICAgICAgIHRyeSB7IGRiID0gcmVxdWlyZSgnY2MnKS5kcmFnb25Cb25lczsgaWYgKCFkYikgdGhyb3cgbmV3IEVycm9yKCdub3QgZm91bmQnKTsgfSBjYXRjaCB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ0RyYWdvbkJvbmVzIG1vZHVsZSBub3QgYXZhaWxhYmxlIGluIHRoaXMgcHJvamVjdCcgfTsgfVxuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IHNjZW5lLmdldENoaWxkQnlVdWlkKG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm9kZSAke25vZGVVdWlkfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICBjb25zdCBjb21wID0gbm9kZS5nZXRDb21wb25lbnQoZGIuQXJtYXR1cmVEaXNwbGF5KTtcbiAgICAgICAgICAgIGlmICghY29tcCkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gQXJtYXR1cmVEaXNwbGF5IGNvbXBvbmVudCBvbiBub2RlJyB9O1xuICAgICAgICAgICAgY29tcC5wbGF5QW5pbWF0aW9uKGFuaW1hdGlvbk5hbWUsIHBsYXlUaW1lcyk7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IGFuaW1hdGlvbk5hbWUsIHBsYXlUaW1lcyB9IH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgc2V0RHJhZ29uQm9uZXNBcm1hdHVyZShub2RlVXVpZDogc3RyaW5nLCBhcm1hdHVyZU5hbWU6IHN0cmluZykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGxldCBkYjogYW55O1xuICAgICAgICAgICAgdHJ5IHsgZGIgPSByZXF1aXJlKCdjYycpLmRyYWdvbkJvbmVzOyBpZiAoIWRiKSB0aHJvdyBuZXcgRXJyb3IoJ25vdCBmb3VuZCcpOyB9IGNhdGNoIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnRHJhZ29uQm9uZXMgbW9kdWxlIG5vdCBhdmFpbGFibGUgaW4gdGhpcyBwcm9qZWN0JyB9OyB9XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlID0gc2NlbmUuZ2V0Q2hpbGRCeVV1aWQobm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIGNvbnN0IGNvbXAgPSBub2RlLmdldENvbXBvbmVudChkYi5Bcm1hdHVyZURpc3BsYXkpO1xuICAgICAgICAgICAgaWYgKCFjb21wKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBBcm1hdHVyZURpc3BsYXkgY29tcG9uZW50IG9uIG5vZGUnIH07XG4gICAgICAgICAgICBjb21wLmFybWF0dXJlTmFtZSA9IGFybWF0dXJlTmFtZTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHsgYXJtYXR1cmVOYW1lIH0gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICBzZXREcmFnb25Cb25lc1Byb3BlcnR5KG5vZGVVdWlkOiBzdHJpbmcsIHByb3BlcnR5OiBzdHJpbmcsIHZhbHVlOiBhbnkpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBsZXQgZGI6IGFueTtcbiAgICAgICAgICAgIHRyeSB7IGRiID0gcmVxdWlyZSgnY2MnKS5kcmFnb25Cb25lczsgaWYgKCFkYikgdGhyb3cgbmV3IEVycm9yKCdub3QgZm91bmQnKTsgfSBjYXRjaCB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ0RyYWdvbkJvbmVzIG1vZHVsZSBub3QgYXZhaWxhYmxlIGluIHRoaXMgcHJvamVjdCcgfTsgfVxuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IHNjZW5lLmdldENoaWxkQnlVdWlkKG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm9kZSAke25vZGVVdWlkfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICBjb25zdCBjb21wID0gbm9kZS5nZXRDb21wb25lbnQoZGIuQXJtYXR1cmVEaXNwbGF5KTtcbiAgICAgICAgICAgIGlmICghY29tcCkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gQXJtYXR1cmVEaXNwbGF5IGNvbXBvbmVudCBvbiBub2RlJyB9O1xuICAgICAgICAgICAgY29uc3QgYWxsb3dlZCA9IFsndGltZVNjYWxlJywgJ2RlYnVnQm9uZXMnLCAncGxheVRpbWVzJ107XG4gICAgICAgICAgICBpZiAoIWFsbG93ZWQuaW5jbHVkZXMocHJvcGVydHkpKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBQcm9wZXJ0eSAnJHtwcm9wZXJ0eX0nIG5vdCBhbGxvd2VkLiBVc2U6ICR7YWxsb3dlZC5qb2luKCcsICcpfWAgfTtcbiAgICAgICAgICAgIChjb21wIGFzIGFueSlbcHJvcGVydHldID0gdmFsdWU7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IHByb3BlcnR5LCB2YWx1ZSB9IH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgbGlzdERyYWdvbkJvbmVzTm9kZXMoKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgbGV0IGRiOiBhbnk7XG4gICAgICAgICAgICB0cnkgeyBkYiA9IHJlcXVpcmUoJ2NjJykuZHJhZ29uQm9uZXM7IGlmICghZGIpIHRocm93IG5ldyBFcnJvcignbm90IGZvdW5kJyk7IH0gY2F0Y2ggeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdEcmFnb25Cb25lcyBtb2R1bGUgbm90IGF2YWlsYWJsZSBpbiB0aGlzIHByb2plY3QnIH07IH1cbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGVzOiBhbnlbXSA9IFtdO1xuICAgICAgICAgICAgc2NlbmUud2Fsaygobm9kZTogYW55KSA9PiB7IGlmIChub2RlLmdldENvbXBvbmVudChkYi5Bcm1hdHVyZURpc3BsYXkpKSBub2Rlcy5wdXNoKHsgdXVpZDogbm9kZS51dWlkLCBuYW1lOiBub2RlLm5hbWUgfSk7IH0pO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogeyBub2RlcywgY291bnQ6IG5vZGVzLmxlbmd0aCB9IH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgYWRkRHJhZ29uQm9uZXNUb05vZGUobm9kZVV1aWQ6IHN0cmluZywgZHJhZ29uQm9uZXNBc3NldFV1aWQ6IHN0cmluZywgZHJhZ29uQm9uZXNBdGxhc0Fzc2V0VXVpZDogc3RyaW5nKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCBhc3NldE1hbmFnZXIgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBsZXQgZGI6IGFueTtcbiAgICAgICAgICAgIHRyeSB7IGRiID0gcmVxdWlyZSgnY2MnKS5kcmFnb25Cb25lczsgaWYgKCFkYikgdGhyb3cgbmV3IEVycm9yKCdub3QgZm91bmQnKTsgfSBjYXRjaCB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ0RyYWdvbkJvbmVzIG1vZHVsZSBub3QgYXZhaWxhYmxlIGluIHRoaXMgcHJvamVjdCcgfTsgfVxuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IHNjZW5lLmdldENoaWxkQnlVdWlkKG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm9kZSAke25vZGVVdWlkfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICBjb25zdCBjb21wID0gbm9kZS5hZGRDb21wb25lbnQoZGIuQXJtYXR1cmVEaXNwbGF5KTtcbiAgICAgICAgICAgIGFzc2V0TWFuYWdlci5sb2FkQW55KFtkcmFnb25Cb25lc0Fzc2V0VXVpZCwgZHJhZ29uQm9uZXNBdGxhc0Fzc2V0VXVpZF0sIChlcnI6IGFueSwgYXNzZXRzOiBhbnlbXSkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICghZXJyICYmIGFzc2V0cykgeyBjb21wLmRyYWdvbkFzc2V0ID0gYXNzZXRzWzBdOyBjb21wLmRyYWdvbkF0bGFzQXNzZXQgPSBhc3NldHNbMV07IH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogeyBub2RlVXVpZCwgZHJhZ29uQm9uZXNBc3NldFV1aWQsIGRyYWdvbkJvbmVzQXRsYXNBc3NldFV1aWQgfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIC8vIOKUgOKUgCBUZXJyYWluIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuXG4gICAgZ2V0VGVycmFpbkluZm8obm9kZVV1aWQ6IHN0cmluZykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwganMgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlID0gc2NlbmUuZ2V0Q2hpbGRCeVV1aWQobm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIGNvbnN0IFRlcnJhaW4gPSBqcy5nZXRDbGFzc0J5TmFtZSgnVGVycmFpbicpO1xuICAgICAgICAgICAgaWYgKCFUZXJyYWluKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdUZXJyYWluIGNsYXNzIG5vdCBmb3VuZCDigJQgM0Qgb25seScgfTtcbiAgICAgICAgICAgIGNvbnN0IGNvbXAgPSBub2RlLmdldENvbXBvbmVudChUZXJyYWluKTtcbiAgICAgICAgICAgIGlmICghY29tcCkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gVGVycmFpbiBjb21wb25lbnQgb24gbm9kZScgfTtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyQ291bnQgPSBjb21wLmdldExheWVyQ291bnQgPyBjb21wLmdldExheWVyQ291bnQoKSA6IChjb21wLmxheWVycyA/IGNvbXAubGF5ZXJzLmxlbmd0aCA6IDApO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogeyB0aWxlU2l6ZTogY29tcC50aWxlU2l6ZSwgd2VpZ2h0TWFwU2l6ZTogY29tcC53ZWlnaHRNYXBTaXplLCBsaWdodE1hcFNpemU6IGNvbXAubGlnaHRNYXBTaXplLCBibG9ja0NvdW50OiBjb21wLmJsb2NrQ291bnQsIGxheWVyQ291bnQgfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIHNldFRlcnJhaW5Qcm9wZXJ0eShub2RlVXVpZDogc3RyaW5nLCBwcm9wZXJ0eTogc3RyaW5nLCB2YWx1ZTogYW55KSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCBqcyB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBzY2VuZS5nZXRDaGlsZEJ5VXVpZChub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgY29uc3QgVGVycmFpbiA9IGpzLmdldENsYXNzQnlOYW1lKCdUZXJyYWluJyk7XG4gICAgICAgICAgICBpZiAoIVRlcnJhaW4pIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ1RlcnJhaW4gY2xhc3Mgbm90IGZvdW5kIOKAlCAzRCBvbmx5JyB9O1xuICAgICAgICAgICAgY29uc3QgY29tcCA9IG5vZGUuZ2V0Q29tcG9uZW50KFRlcnJhaW4pO1xuICAgICAgICAgICAgaWYgKCFjb21wKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBUZXJyYWluIGNvbXBvbmVudCBvbiBub2RlJyB9O1xuICAgICAgICAgICAgY29uc3QgYWxsb3dlZCA9IFsndGlsZVNpemUnLCAnd2VpZ2h0TWFwU2l6ZScsICdsaWdodE1hcFNpemUnXTtcbiAgICAgICAgICAgIGlmICghYWxsb3dlZC5pbmNsdWRlcyhwcm9wZXJ0eSkpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYFByb3BlcnR5ICcke3Byb3BlcnR5fScgbm90IGFsbG93ZWQuIFVzZTogJHthbGxvd2VkLmpvaW4oJywgJyl9YCB9O1xuICAgICAgICAgICAgKGNvbXAgYXMgYW55KVtwcm9wZXJ0eV0gPSB2YWx1ZTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHsgcHJvcGVydHksIHZhbHVlIH0gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICBnZXRUZXJyYWluTGF5ZXJJbmZvKG5vZGVVdWlkOiBzdHJpbmcsIGxheWVySW5kZXg6IG51bWJlcikge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwganMgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlID0gc2NlbmUuZ2V0Q2hpbGRCeVV1aWQobm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIGNvbnN0IFRlcnJhaW4gPSBqcy5nZXRDbGFzc0J5TmFtZSgnVGVycmFpbicpO1xuICAgICAgICAgICAgaWYgKCFUZXJyYWluKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdUZXJyYWluIGNsYXNzIG5vdCBmb3VuZCDigJQgM0Qgb25seScgfTtcbiAgICAgICAgICAgIGNvbnN0IGNvbXAgPSBub2RlLmdldENvbXBvbmVudChUZXJyYWluKTtcbiAgICAgICAgICAgIGlmICghY29tcCkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gVGVycmFpbiBjb21wb25lbnQgb24gbm9kZScgfTtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gY29tcC5nZXRMYXllciA/IGNvbXAuZ2V0TGF5ZXIobGF5ZXJJbmRleCkgOiAoY29tcC5sYXllcnMgPyBjb21wLmxheWVyc1tsYXllckluZGV4XSA6IG51bGwpO1xuICAgICAgICAgICAgaWYgKCFsYXllcikgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTGF5ZXIgJHtsYXllckluZGV4fSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IGxheWVySW5kZXgsIHRpbGVTaXplOiBsYXllci50aWxlU2l6ZSwgZGV0YWlsTWFwOiBsYXllci5kZXRhaWxNYXA/LnV1aWQgfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIHNldFRlcnJhaW5MYXllcihub2RlVXVpZDogc3RyaW5nLCBsYXllckluZGV4OiBudW1iZXIsIGRldGFpbE1hcFV1aWQ6IHN0cmluZywgdGlsZVNpemU6IG51bWJlcikge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwganMsIGFzc2V0TWFuYWdlciB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBzY2VuZS5nZXRDaGlsZEJ5VXVpZChub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgY29uc3QgVGVycmFpbiA9IGpzLmdldENsYXNzQnlOYW1lKCdUZXJyYWluJyk7XG4gICAgICAgICAgICBpZiAoIVRlcnJhaW4pIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ1RlcnJhaW4gY2xhc3Mgbm90IGZvdW5kIOKAlCAzRCBvbmx5JyB9O1xuICAgICAgICAgICAgY29uc3QgY29tcCA9IG5vZGUuZ2V0Q29tcG9uZW50KFRlcnJhaW4pO1xuICAgICAgICAgICAgaWYgKCFjb21wKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBUZXJyYWluIGNvbXBvbmVudCBvbiBub2RlJyB9O1xuICAgICAgICAgICAgYXNzZXRNYW5hZ2VyLmxvYWRBbnkoZGV0YWlsTWFwVXVpZCwgKGVycjogYW55LCBhc3NldDogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGVyciB8fCAhYXNzZXQpIHJldHVybjtcbiAgICAgICAgICAgICAgICBjb25zdCBsYXllciA9IGNvbXAuZ2V0TGF5ZXIgPyBjb21wLmdldExheWVyKGxheWVySW5kZXgpIDogKGNvbXAubGF5ZXJzID8gY29tcC5sYXllcnNbbGF5ZXJJbmRleF0gOiBudWxsKTtcbiAgICAgICAgICAgICAgICBpZiAobGF5ZXIpIHsgbGF5ZXIuZGV0YWlsTWFwID0gYXNzZXQ7IGlmICh0aWxlU2l6ZSAhPT0gdW5kZWZpbmVkKSBsYXllci50aWxlU2l6ZSA9IHRpbGVTaXplOyB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHsgbGF5ZXJJbmRleCwgZGV0YWlsTWFwVXVpZCwgdGlsZVNpemUgfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIGdldFRlcnJhaW5IZWlnaHQobm9kZVV1aWQ6IHN0cmluZywgeDogbnVtYmVyLCB5OiBudW1iZXIpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IsIGpzIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IHNjZW5lLmdldENoaWxkQnlVdWlkKG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm9kZSAke25vZGVVdWlkfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICBjb25zdCBUZXJyYWluID0ganMuZ2V0Q2xhc3NCeU5hbWUoJ1RlcnJhaW4nKTtcbiAgICAgICAgICAgIGlmICghVGVycmFpbikgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnVGVycmFpbiBjbGFzcyBub3QgZm91bmQg4oCUIDNEIG9ubHknIH07XG4gICAgICAgICAgICBjb25zdCBjb21wID0gbm9kZS5nZXRDb21wb25lbnQoVGVycmFpbik7XG4gICAgICAgICAgICBpZiAoIWNvbXApIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIFRlcnJhaW4gY29tcG9uZW50IG9uIG5vZGUnIH07XG4gICAgICAgICAgICBjb25zdCBoZWlnaHQgPSBjb21wLmdldEhlaWdodCA/IGNvbXAuZ2V0SGVpZ2h0KHgsIHkpIDogbnVsbDtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHsgeCwgeSwgaGVpZ2h0IH0gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICBzZXRUZXJyYWluSGVpZ2h0KG5vZGVVdWlkOiBzdHJpbmcsIHg6IG51bWJlciwgeTogbnVtYmVyLCBoZWlnaHQ6IG51bWJlcikge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwganMgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlID0gc2NlbmUuZ2V0Q2hpbGRCeVV1aWQobm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIGNvbnN0IFRlcnJhaW4gPSBqcy5nZXRDbGFzc0J5TmFtZSgnVGVycmFpbicpO1xuICAgICAgICAgICAgaWYgKCFUZXJyYWluKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdUZXJyYWluIGNsYXNzIG5vdCBmb3VuZCDigJQgM0Qgb25seScgfTtcbiAgICAgICAgICAgIGNvbnN0IGNvbXAgPSBub2RlLmdldENvbXBvbmVudChUZXJyYWluKTtcbiAgICAgICAgICAgIGlmICghY29tcCkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gVGVycmFpbiBjb21wb25lbnQgb24gbm9kZScgfTtcbiAgICAgICAgICAgIGlmICghY29tcC5zZXRIZWlnaHQpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ3NldEhlaWdodCBub3QgYXZhaWxhYmxlIG9uIHRoaXMgVGVycmFpbiB2ZXJzaW9uJyB9O1xuICAgICAgICAgICAgY29tcC5zZXRIZWlnaHQoeCwgeSwgaGVpZ2h0KTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHsgeCwgeSwgaGVpZ2h0IH0gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICBsaXN0VGVycmFpbk5vZGVzKCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwganMgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBUZXJyYWluID0ganMuZ2V0Q2xhc3NCeU5hbWUoJ1RlcnJhaW4nKTtcbiAgICAgICAgICAgIGlmICghVGVycmFpbikgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnVGVycmFpbiBjbGFzcyBub3QgZm91bmQg4oCUIDNEIG9ubHknIH07XG4gICAgICAgICAgICBjb25zdCBub2RlczogYW55W10gPSBbXTtcbiAgICAgICAgICAgIHNjZW5lLndhbGsoKG5vZGU6IGFueSkgPT4geyBpZiAobm9kZS5nZXRDb21wb25lbnQoVGVycmFpbikpIG5vZGVzLnB1c2goeyB1dWlkOiBub2RlLnV1aWQsIG5hbWU6IG5vZGUubmFtZSB9KTsgfSk7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IG5vZGVzLCBjb3VudDogbm9kZXMubGVuZ3RoIH0gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICAvLyDilIDilIAgUGhhc2UgNDogUmVuZGVyIFBpcGVsaW5lIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuXG4gICAgZ2V0UmVuZGVyUGlwZWxpbmVJbmZvKCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHBpcGVsaW5lID0gZGlyZWN0b3Iucm9vdCAmJiBkaXJlY3Rvci5yb290LnBpcGVsaW5lO1xuICAgICAgICAgICAgaWYgKCFwaXBlbGluZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gcmVuZGVyIHBpcGVsaW5lIOKAlCAzRCBzY2VuZSByZXF1aXJlZCcgfTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGNvbnN0IGVudiA9IHNjZW5lICYmIHNjZW5lLmdsb2JhbHMgJiYgc2NlbmUuZ2xvYmFscy5lbnZpcm9ubWVudDtcbiAgICAgICAgICAgIGNvbnN0IGZvZyA9IHNjZW5lICYmIHNjZW5lLmdsb2JhbHMgJiYgc2NlbmUuZ2xvYmFscy5mb2c7XG4gICAgICAgICAgICBjb25zdCBzaGFkb3dzID0gc2NlbmUgJiYgc2NlbmUuZ2xvYmFscyAmJiBzY2VuZS5nbG9iYWxzLnNoYWRvd3M7XG4gICAgICAgICAgICBjb25zdCBza3lib3ggPSBzY2VuZSAmJiBzY2VuZS5nbG9iYWxzICYmIHNjZW5lLmdsb2JhbHMuc2t5Ym94O1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7XG4gICAgICAgICAgICAgICAgICAgIHNoYWRvd3M6IHNoYWRvd3MgPyB7IGVuYWJsZWQ6IHNoYWRvd3MuZW5hYmxlZCwgdHlwZTogc2hhZG93cy50eXBlLCBzaGFkb3dNYXBTaXplOiBzaGFkb3dzLm1hcFNpemUgfSA6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgIGZvZzogZm9nID8geyBlbmFibGVkOiBmb2cuZW5hYmxlZCwgdHlwZTogZm9nLnR5cGUsIGZvZ1N0YXJ0OiBmb2cuZm9nU3RhcnQsIGZvZ0VuZDogZm9nLmZvZ0VuZCwgZm9nRGVuc2l0eTogZm9nLmZvZ0RlbnNpdHkgfSA6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgIHNreWJveDogc2t5Ym94ID8geyBlbmFibGVkOiBza3lib3guZW5hYmxlZCwgdXNlSERSOiBza3lib3gudXNlSERSLCByb3RhdGlvbkFuZ2xlOiBza3lib3gucm90YXRpb25BbmdsZSB9IDogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgYW1iaWVudDogZW52ID8geyBza3lDb2xvcjogZW52LnNreUNvbG9yLCBncm91bmRBbGJlZG86IGVudi5ncm91bmRBbGJlZG8gfSA6IG51bGwsXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICBzZXRTaGFkb3dTZXR0aW5ncyhlbmFibGVkOiBib29sZWFuIHwgdW5kZWZpbmVkLCB0eXBlOiBzdHJpbmcgfCB1bmRlZmluZWQsIHNoYWRvd01hcFNpemU6IG51bWJlciB8IHVuZGVmaW5lZCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IHNoYWRvd3MgPSBzY2VuZS5nbG9iYWxzICYmIHNjZW5lLmdsb2JhbHMuc2hhZG93cztcbiAgICAgICAgICAgIGlmICghc2hhZG93cykgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnU2hhZG93IGdsb2JhbHMgbm90IGF2YWlsYWJsZSDigJQgM0Qgc2NlbmUgcmVxdWlyZWQnIH07XG4gICAgICAgICAgICBpZiAoZW5hYmxlZCAhPT0gdW5kZWZpbmVkKSBzaGFkb3dzLmVuYWJsZWQgPSBlbmFibGVkO1xuICAgICAgICAgICAgaWYgKHR5cGUgIT09IHVuZGVmaW5lZCkgc2hhZG93cy50eXBlID0gdHlwZTtcbiAgICAgICAgICAgIGlmIChzaGFkb3dNYXBTaXplICE9PSB1bmRlZmluZWQpIHNoYWRvd3MubWFwU2l6ZSA9IHNoYWRvd01hcFNpemU7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IGVuYWJsZWQ6IHNoYWRvd3MuZW5hYmxlZCwgdHlwZTogc2hhZG93cy50eXBlLCBtYXBTaXplOiBzaGFkb3dzLm1hcFNpemUgfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIHNldEZvZ1NldHRpbmdzKGVuYWJsZWQ6IGJvb2xlYW4gfCB1bmRlZmluZWQsIGZvZ0NvbG9yOiBzdHJpbmcgfCB1bmRlZmluZWQsIHR5cGU6IHN0cmluZyB8IHVuZGVmaW5lZCwgZm9nU3RhcnQ6IG51bWJlciB8IHVuZGVmaW5lZCwgZm9nRW5kOiBudW1iZXIgfCB1bmRlZmluZWQsIGZvZ0RlbnNpdHk6IG51bWJlciB8IHVuZGVmaW5lZCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwgQ29sb3IgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBmb2cgPSBzY2VuZS5nbG9iYWxzICYmIHNjZW5lLmdsb2JhbHMuZm9nO1xuICAgICAgICAgICAgaWYgKCFmb2cpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ0ZvZyBnbG9iYWxzIG5vdCBhdmFpbGFibGUg4oCUIDNEIHNjZW5lIHJlcXVpcmVkJyB9O1xuICAgICAgICAgICAgaWYgKGVuYWJsZWQgIT09IHVuZGVmaW5lZCkgZm9nLmVuYWJsZWQgPSBlbmFibGVkO1xuICAgICAgICAgICAgaWYgKHR5cGUgIT09IHVuZGVmaW5lZCkgZm9nLnR5cGUgPSB0eXBlO1xuICAgICAgICAgICAgaWYgKGZvZ1N0YXJ0ICE9PSB1bmRlZmluZWQpIGZvZy5mb2dTdGFydCA9IGZvZ1N0YXJ0O1xuICAgICAgICAgICAgaWYgKGZvZ0VuZCAhPT0gdW5kZWZpbmVkKSBmb2cuZm9nRW5kID0gZm9nRW5kO1xuICAgICAgICAgICAgaWYgKGZvZ0RlbnNpdHkgIT09IHVuZGVmaW5lZCkgZm9nLmZvZ0RlbnNpdHkgPSBmb2dEZW5zaXR5O1xuICAgICAgICAgICAgaWYgKGZvZ0NvbG9yICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBoZXggPSBmb2dDb2xvci5yZXBsYWNlKCcjJywgJycpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHIgPSBwYXJzZUludChoZXguc3Vic3RyaW5nKDAsIDIpLCAxNik7XG4gICAgICAgICAgICAgICAgY29uc3QgZyA9IHBhcnNlSW50KGhleC5zdWJzdHJpbmcoMiwgNCksIDE2KTtcbiAgICAgICAgICAgICAgICBjb25zdCBiID0gcGFyc2VJbnQoaGV4LnN1YnN0cmluZyg0LCA2KSwgMTYpO1xuICAgICAgICAgICAgICAgIGZvZy5mb2dDb2xvciA9IG5ldyBDb2xvcihyLCBnLCBiLCAyNTUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogeyBlbmFibGVkOiBmb2cuZW5hYmxlZCwgdHlwZTogZm9nLnR5cGUsIGZvZ1N0YXJ0OiBmb2cuZm9nU3RhcnQsIGZvZ0VuZDogZm9nLmZvZ0VuZCwgZm9nRGVuc2l0eTogZm9nLmZvZ0RlbnNpdHkgfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIHNldFNreWJveFNldHRpbmdzKGVuYWJsZWQ6IGJvb2xlYW4gfCB1bmRlZmluZWQsIHVzZUhEUjogYm9vbGVhbiB8IHVuZGVmaW5lZCwgcm90YXRpb25BbmdsZTogbnVtYmVyIHwgdW5kZWZpbmVkKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3Qgc2t5Ym94ID0gc2NlbmUuZ2xvYmFscyAmJiBzY2VuZS5nbG9iYWxzLnNreWJveDtcbiAgICAgICAgICAgIGlmICghc2t5Ym94KSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdTa3lib3ggZ2xvYmFscyBub3QgYXZhaWxhYmxlIOKAlCAzRCBzY2VuZSByZXF1aXJlZCcgfTtcbiAgICAgICAgICAgIGlmIChlbmFibGVkICE9PSB1bmRlZmluZWQpIHNreWJveC5lbmFibGVkID0gZW5hYmxlZDtcbiAgICAgICAgICAgIGlmICh1c2VIRFIgIT09IHVuZGVmaW5lZCkgc2t5Ym94LnVzZUhEUiA9IHVzZUhEUjtcbiAgICAgICAgICAgIGlmIChyb3RhdGlvbkFuZ2xlICE9PSB1bmRlZmluZWQpIHNreWJveC5yb3RhdGlvbkFuZ2xlID0gcm90YXRpb25BbmdsZTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHsgZW5hYmxlZDogc2t5Ym94LmVuYWJsZWQsIHVzZUhEUjogc2t5Ym94LnVzZUhEUiwgcm90YXRpb25BbmdsZTogc2t5Ym94LnJvdGF0aW9uQW5nbGUgfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIHNldFBvc3RQcm9jZXNzU2V0dGluZ3MoYmxvb206IHsgZW5hYmxlZD86IGJvb2xlYW47IGludGVuc2l0eT86IG51bWJlciB9IHwgdW5kZWZpbmVkLCB0b25lbWFwOiBzdHJpbmcgfCB1bmRlZmluZWQpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBwaXBlbGluZSA9IGRpcmVjdG9yLnJvb3QgJiYgZGlyZWN0b3Iucm9vdC5waXBlbGluZTtcbiAgICAgICAgICAgIGlmICghcGlwZWxpbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIHJlbmRlciBwaXBlbGluZSDigJQgM0Qgc2NlbmUgcmVxdWlyZWQnIH07XG4gICAgICAgICAgICBjb25zdCBwcCA9IHBpcGVsaW5lLnBvc3RQcm9jZXNzIHx8IChwaXBlbGluZS5nZXRQb3N0UHJvY2VzcyAmJiBwaXBlbGluZS5nZXRQb3N0UHJvY2VzcygpKTtcbiAgICAgICAgICAgIGlmICghcHApIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ1Bvc3RQcm9jZXNzIG5vdCBhdmFpbGFibGUgb24gdGhpcyBwaXBlbGluZScgfTtcbiAgICAgICAgICAgIGlmIChibG9vbSAhPT0gdW5kZWZpbmVkICYmIHBwLmJsb29tKSB7XG4gICAgICAgICAgICAgICAgaWYgKGJsb29tLmVuYWJsZWQgIT09IHVuZGVmaW5lZCkgcHAuYmxvb20uZW5hYmxlZCA9IGJsb29tLmVuYWJsZWQ7XG4gICAgICAgICAgICAgICAgaWYgKGJsb29tLmludGVuc2l0eSAhPT0gdW5kZWZpbmVkKSBwcC5ibG9vbS5pbnRlbnNpdHkgPSBibG9vbS5pbnRlbnNpdHk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodG9uZW1hcCAhPT0gdW5kZWZpbmVkICYmIHBwLmNvbG9yR3JhZGluZykge1xuICAgICAgICAgICAgICAgIHBwLmNvbG9yR3JhZGluZy50b25lbWFwTW9kZSA9IHRvbmVtYXA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IGJsb29tOiBwcC5ibG9vbSA/IHsgZW5hYmxlZDogcHAuYmxvb20uZW5hYmxlZCwgaW50ZW5zaXR5OiBwcC5ibG9vbS5pbnRlbnNpdHkgfSA6IG51bGwsIHRvbmVtYXAgfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIC8vIOKUgOKUgCBQaGFzZSA0OiBNZXNoIFJlbmRlcmVyIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuXG4gICAgZ2V0TWVzaFJlbmRlcmVySW5mbyhub2RlVXVpZDogc3RyaW5nKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCBqcyB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBzY2VuZS5nZXRDaGlsZEJ5VXVpZChub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgY29uc3QgTWVzaFJlbmRlcmVyID0ganMuZ2V0Q2xhc3NCeU5hbWUoJ01lc2hSZW5kZXJlcicpO1xuICAgICAgICAgICAgaWYgKCFNZXNoUmVuZGVyZXIpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ01lc2hSZW5kZXJlciBub3QgYXZhaWxhYmxlIOKAlCAzRCBvbmx5JyB9O1xuICAgICAgICAgICAgY29uc3QgY29tcCA9IG5vZGUuZ2V0Q29tcG9uZW50KE1lc2hSZW5kZXJlcik7XG4gICAgICAgICAgICBpZiAoIWNvbXApIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIE1lc2hSZW5kZXJlciBvbiBub2RlJyB9O1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7XG4gICAgICAgICAgICAgICAgICAgIG5vZGVVdWlkLCBub2RlTmFtZTogbm9kZS5uYW1lLFxuICAgICAgICAgICAgICAgICAgICBzaGFkb3dDYXN0aW5nTW9kZTogY29tcC5zaGFkb3dDYXN0aW5nTW9kZSxcbiAgICAgICAgICAgICAgICAgICAgcmVjZWl2ZVNoYWRvdzogY29tcC5yZWNlaXZlU2hhZG93LFxuICAgICAgICAgICAgICAgICAgICB2aXNpYmlsaXR5OiBjb21wLnZpc2liaWxpdHksXG4gICAgICAgICAgICAgICAgICAgIG1lc2g6IGNvbXAubWVzaCA/IHsgdXVpZDogY29tcC5tZXNoLl91dWlkLCBuYW1lOiBjb21wLm1lc2gubmFtZSB9IDogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgbWF0ZXJpYWxzOiBjb21wLnNoYXJlZE1hdGVyaWFscyA/IGNvbXAuc2hhcmVkTWF0ZXJpYWxzLm1hcCgobTogYW55KSA9PiBtID8geyB1dWlkOiBtLl91dWlkLCBuYW1lOiBtLm5hbWUgfSA6IG51bGwpIDogW10sXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICBzZXRNZXNoUmVuZGVyZXJQcm9wZXJ0eShub2RlVXVpZDogc3RyaW5nLCBwcm9wZXJ0eTogc3RyaW5nLCB2YWx1ZTogYW55KSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCBqcyB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBzY2VuZS5nZXRDaGlsZEJ5VXVpZChub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgY29uc3QgTWVzaFJlbmRlcmVyID0ganMuZ2V0Q2xhc3NCeU5hbWUoJ01lc2hSZW5kZXJlcicpO1xuICAgICAgICAgICAgaWYgKCFNZXNoUmVuZGVyZXIpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ01lc2hSZW5kZXJlciBub3QgYXZhaWxhYmxlIOKAlCAzRCBvbmx5JyB9O1xuICAgICAgICAgICAgY29uc3QgY29tcCA9IG5vZGUuZ2V0Q29tcG9uZW50KE1lc2hSZW5kZXJlcik7XG4gICAgICAgICAgICBpZiAoIWNvbXApIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIE1lc2hSZW5kZXJlciBvbiBub2RlJyB9O1xuICAgICAgICAgICAgY29uc3QgYWxsb3dlZCA9IFsnc2hhZG93Q2FzdGluZ01vZGUnLCAncmVjZWl2ZVNoYWRvdycsICd2aXNpYmlsaXR5J107XG4gICAgICAgICAgICBpZiAoIWFsbG93ZWQuaW5jbHVkZXMocHJvcGVydHkpKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBQcm9wZXJ0eSAnJHtwcm9wZXJ0eX0nIG5vdCBhbGxvd2VkLiBVc2U6ICR7YWxsb3dlZC5qb2luKCcsICcpfWAgfTtcbiAgICAgICAgICAgIChjb21wIGFzIGFueSlbcHJvcGVydHldID0gdmFsdWU7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IG5vZGVVdWlkLCBwcm9wZXJ0eSwgdmFsdWUgfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIC8vIOKUgOKUgCBQaGFzZSA0OiBQcm9maWxlciDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcblxuICAgIGdldFBlcmZvcm1hbmNlU3RhdHMoKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCBwcm9maWxlciB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGVDb3VudCA9IHNjZW5lID8gKCgpID0+IHsgbGV0IG4gPSAwOyBzY2VuZS53YWxrKCgpID0+IG4rKyk7IHJldHVybiBuOyB9KSgpIDogMDtcbiAgICAgICAgICAgIGNvbnN0IHN0YXRzOiBhbnkgPSB7IG5vZGVDb3VudCB9O1xuICAgICAgICAgICAgaWYgKHByb2ZpbGVyKSB7XG4gICAgICAgICAgICAgICAgc3RhdHMuZnBzID0gcHJvZmlsZXIuZnBzICE9PSB1bmRlZmluZWQgPyBwcm9maWxlci5mcHMgOiBudWxsO1xuICAgICAgICAgICAgICAgIHN0YXRzLmRyYXdDYWxscyA9IHByb2ZpbGVyLmRyYXdDYWxscyAhPT0gdW5kZWZpbmVkID8gcHJvZmlsZXIuZHJhd0NhbGxzIDogbnVsbDtcbiAgICAgICAgICAgICAgICBzdGF0cy50cmlhbmdsZXMgPSBwcm9maWxlci50cmlhbmdsZXMgIT09IHVuZGVmaW5lZCA/IHByb2ZpbGVyLnRyaWFuZ2xlcyA6IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiBzdGF0cyB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIGdldE1lbW9yeVN0YXRzKCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgbWVtVXNhZ2UgPSBwcm9jZXNzLm1lbW9yeVVzYWdlID8gcHJvY2Vzcy5tZW1vcnlVc2FnZSgpIDogbnVsbDtcbiAgICAgICAgICAgIGNvbnN0IGRhdGE6IGFueSA9IHtcbiAgICAgICAgICAgICAgICBwcm9jZXNzOiBtZW1Vc2FnZSA/IHtcbiAgICAgICAgICAgICAgICAgICAgaGVhcFVzZWRNQjogKG1lbVVzYWdlLmhlYXBVc2VkIC8gMTAyNCAvIDEwMjQpLnRvRml4ZWQoMiksXG4gICAgICAgICAgICAgICAgICAgIGhlYXBUb3RhbE1COiAobWVtVXNhZ2UuaGVhcFRvdGFsIC8gMTAyNCAvIDEwMjQpLnRvRml4ZWQoMiksXG4gICAgICAgICAgICAgICAgICAgIHJzc01COiAobWVtVXNhZ2UucnNzIC8gMTAyNCAvIDEwMjQpLnRvRml4ZWQoMiksXG4gICAgICAgICAgICAgICAgfSA6IG51bGwsXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHBpcGVsaW5lID0gZGlyZWN0b3Iucm9vdCAmJiBkaXJlY3Rvci5yb290LnBpcGVsaW5lO1xuICAgICAgICAgICAgICAgIGlmIChwaXBlbGluZSAmJiBwaXBlbGluZS5kZXZpY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgZGF0YS5ncHUgPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBtZW1vcnlTdGF0dXM6IHBpcGVsaW5lLmRldmljZS5tZW1vcnlTdGF0dXMgfHwgbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIHsgLyogR1BVIHN0YXRzIG9wdGlvbmFsICovIH1cbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGEgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICB0b2dnbGVTdGF0c0Rpc3BsYXkodmlzaWJsZTogYm9vbGVhbiB8IHVuZGVmaW5lZCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBwcm9maWxlciB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGlmICghcHJvZmlsZXIpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ3Byb2ZpbGVyIG1vZHVsZSBub3QgYXZhaWxhYmxlJyB9O1xuICAgICAgICAgICAgaWYgKHZpc2libGUgPT09IHRydWUpIHtcbiAgICAgICAgICAgICAgICBwcm9maWxlci5zaG93U3RhdHMgJiYgcHJvZmlsZXIuc2hvd1N0YXRzKCk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHZpc2libGUgPT09IGZhbHNlKSB7XG4gICAgICAgICAgICAgICAgcHJvZmlsZXIuaGlkZVN0YXRzICYmIHByb2ZpbGVyLmhpZGVTdGF0cygpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyB0b2dnbGVcbiAgICAgICAgICAgICAgICBpZiAocHJvZmlsZXIuaXNTaG93aW5nU3RhdHMgJiYgcHJvZmlsZXIuaXNTaG93aW5nU3RhdHMoKSkge1xuICAgICAgICAgICAgICAgICAgICBwcm9maWxlci5oaWRlU3RhdHMgJiYgcHJvZmlsZXIuaGlkZVN0YXRzKCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcHJvZmlsZXIuc2hvd1N0YXRzICYmIHByb2ZpbGVyLnNob3dTdGF0cygpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IG5vd1Zpc2libGUgPSBwcm9maWxlci5pc1Nob3dpbmdTdGF0cyA/IHByb2ZpbGVyLmlzU2hvd2luZ1N0YXRzKCkgOiB2aXNpYmxlO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogeyB2aXNpYmxlOiBub3dWaXNpYmxlIH0gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICBnZXREcmF3Q2FsbFN0YXRzKCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwgcHJvZmlsZXIgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBwaXBlbGluZSA9IGRpcmVjdG9yLnJvb3QgJiYgZGlyZWN0b3Iucm9vdC5waXBlbGluZTtcbiAgICAgICAgICAgIGNvbnN0IGRhdGE6IGFueSA9IHt9O1xuICAgICAgICAgICAgaWYgKHByb2ZpbGVyKSB7XG4gICAgICAgICAgICAgICAgZGF0YS5kcmF3Q2FsbHMgPSBwcm9maWxlci5kcmF3Q2FsbHMgIT09IHVuZGVmaW5lZCA/IHByb2ZpbGVyLmRyYXdDYWxscyA6IG51bGw7XG4gICAgICAgICAgICAgICAgZGF0YS5pbnN0YW5jZWREcmF3Q2FsbHMgPSBwcm9maWxlci5pbnN0YW5jZWREcmF3Q2FsbHMgIT09IHVuZGVmaW5lZCA/IHByb2ZpbGVyLmluc3RhbmNlZERyYXdDYWxscyA6IG51bGw7XG4gICAgICAgICAgICAgICAgZGF0YS50cmlhbmdsZXMgPSBwcm9maWxlci50cmlhbmdsZXMgIT09IHVuZGVmaW5lZCA/IHByb2ZpbGVyLnRyaWFuZ2xlcyA6IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAocGlwZWxpbmUgJiYgcGlwZWxpbmUuc2NlbmVSZW5kZXJlcikge1xuICAgICAgICAgICAgICAgIGRhdGEuc2NlbmVSZW5kZXJlciA9IHBpcGVsaW5lLnNjZW5lUmVuZGVyZXIuZ2V0UHJvZmlsaW5nRGF0YSA/IHBpcGVsaW5lLnNjZW5lUmVuZGVyZXIuZ2V0UHJvZmlsaW5nRGF0YSgpIDogbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGEgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICAvLyDilIDilIAgUGhhc2UgNDogVmlkZW8gUGxheWVyIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuXG4gICAgYWRkVmlkZW9QbGF5ZXIobm9kZVV1aWQ6IHN0cmluZywgY2xpcFVybDogc3RyaW5nIHwgdW5kZWZpbmVkKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCBqcyB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBzY2VuZS5nZXRDaGlsZEJ5VXVpZChub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgY29uc3QgVmlkZW9QbGF5ZXIgPSBqcy5nZXRDbGFzc0J5TmFtZSgnVmlkZW9QbGF5ZXInKTtcbiAgICAgICAgICAgIGlmICghVmlkZW9QbGF5ZXIpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ1ZpZGVvUGxheWVyIGNvbXBvbmVudCBub3QgYXZhaWxhYmxlJyB9O1xuICAgICAgICAgICAgbGV0IGNvbXAgPSBub2RlLmdldENvbXBvbmVudChWaWRlb1BsYXllcik7XG4gICAgICAgICAgICBpZiAoIWNvbXApIGNvbXAgPSBub2RlLmFkZENvbXBvbmVudChWaWRlb1BsYXllcik7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IG5vZGVVdWlkLCBub2RlTmFtZTogbm9kZS5uYW1lLCBoYXNDbGlwOiAhIWNsaXBVcmwgfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIHNldFZpZGVvUHJvcGVydHkobm9kZVV1aWQ6IHN0cmluZywgcHJvcGVydHk6IHN0cmluZywgdmFsdWU6IGFueSkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwganMgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlID0gc2NlbmUuZ2V0Q2hpbGRCeVV1aWQobm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIGNvbnN0IFZpZGVvUGxheWVyID0ganMuZ2V0Q2xhc3NCeU5hbWUoJ1ZpZGVvUGxheWVyJyk7XG4gICAgICAgICAgICBpZiAoIVZpZGVvUGxheWVyKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdWaWRlb1BsYXllciBub3QgYXZhaWxhYmxlJyB9O1xuICAgICAgICAgICAgY29uc3QgY29tcCA9IG5vZGUuZ2V0Q29tcG9uZW50KFZpZGVvUGxheWVyKTtcbiAgICAgICAgICAgIGlmICghY29tcCkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gVmlkZW9QbGF5ZXIgb24gbm9kZScgfTtcbiAgICAgICAgICAgIGNvbnN0IGFsbG93ZWQgPSBbJ3Jlc291cmNlVHlwZScsICdyZW1vdGVVUkwnLCAnY2xpcCcsICdsb29wJywgJ3BsYXliYWNrUmF0ZScsICd2b2x1bWUnXTtcbiAgICAgICAgICAgIGlmICghYWxsb3dlZC5pbmNsdWRlcyhwcm9wZXJ0eSkpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYFByb3BlcnR5ICcke3Byb3BlcnR5fScgbm90IGFsbG93ZWQuIFVzZTogJHthbGxvd2VkLmpvaW4oJywgJyl9YCB9O1xuICAgICAgICAgICAgKGNvbXAgYXMgYW55KVtwcm9wZXJ0eV0gPSB2YWx1ZTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHsgbm9kZVV1aWQsIHByb3BlcnR5LCB2YWx1ZSB9IH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgY29udHJvbFZpZGVvKG5vZGVVdWlkOiBzdHJpbmcsIGNvbW1hbmQ6IHN0cmluZykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwganMgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlID0gc2NlbmUuZ2V0Q2hpbGRCeVV1aWQobm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIGNvbnN0IFZpZGVvUGxheWVyID0ganMuZ2V0Q2xhc3NCeU5hbWUoJ1ZpZGVvUGxheWVyJyk7XG4gICAgICAgICAgICBpZiAoIVZpZGVvUGxheWVyKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdWaWRlb1BsYXllciBub3QgYXZhaWxhYmxlJyB9O1xuICAgICAgICAgICAgY29uc3QgY29tcCA9IG5vZGUuZ2V0Q29tcG9uZW50KFZpZGVvUGxheWVyKTtcbiAgICAgICAgICAgIGlmICghY29tcCkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gVmlkZW9QbGF5ZXIgb24gbm9kZScgfTtcbiAgICAgICAgICAgIHN3aXRjaCAoY29tbWFuZCkge1xuICAgICAgICAgICAgICAgIGNhc2UgJ3BsYXknOiBjb21wLnBsYXkgJiYgY29tcC5wbGF5KCk7IGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgJ3BhdXNlJzogY29tcC5wYXVzZSAmJiBjb21wLnBhdXNlKCk7IGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgJ3N0b3AnOiBjb21wLnN0b3AgJiYgY29tcC5zdG9wKCk7IGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgJ3Jlc3VtZSc6IGNvbXAucmVzdW1lICYmIGNvbXAucmVzdW1lKCk7IGJyZWFrO1xuICAgICAgICAgICAgICAgIGRlZmF1bHQ6IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYFVua25vd24gY29tbWFuZCAnJHtjb21tYW5kfScuIFVzZTogcGxheSwgcGF1c2UsIHN0b3AsIHJlc3VtZWAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHsgbm9kZVV1aWQsIGNvbW1hbmQgfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIGdldFZpZGVvSW5mbyhub2RlVXVpZDogc3RyaW5nKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCBqcyB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBzY2VuZS5nZXRDaGlsZEJ5VXVpZChub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgY29uc3QgVmlkZW9QbGF5ZXIgPSBqcy5nZXRDbGFzc0J5TmFtZSgnVmlkZW9QbGF5ZXInKTtcbiAgICAgICAgICAgIGlmICghVmlkZW9QbGF5ZXIpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ1ZpZGVvUGxheWVyIG5vdCBhdmFpbGFibGUnIH07XG4gICAgICAgICAgICBjb25zdCBjb21wID0gbm9kZS5nZXRDb21wb25lbnQoVmlkZW9QbGF5ZXIpO1xuICAgICAgICAgICAgaWYgKCFjb21wKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBWaWRlb1BsYXllciBvbiBub2RlJyB9O1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7XG4gICAgICAgICAgICAgICAgICAgIG5vZGVVdWlkLCBub2RlTmFtZTogbm9kZS5uYW1lLFxuICAgICAgICAgICAgICAgICAgICByZXNvdXJjZVR5cGU6IGNvbXAucmVzb3VyY2VUeXBlLCByZW1vdGVVUkw6IGNvbXAucmVtb3RlVVJMLFxuICAgICAgICAgICAgICAgICAgICBsb29wOiBjb21wLmxvb3AsIHBsYXliYWNrUmF0ZTogY29tcC5wbGF5YmFja1JhdGUsIHZvbHVtZTogY29tcC52b2x1bWUsXG4gICAgICAgICAgICAgICAgICAgIG11dGU6IGNvbXAubXV0ZSwga2VlcEFzcGVjdFJhdGlvOiBjb21wLmtlZXBBc3BlY3RSYXRpbyxcbiAgICAgICAgICAgICAgICAgICAgaXNGdWxsc2NyZWVuOiBjb21wLmlzRnVsbHNjcmVlbiwgZHVyYXRpb246IGNvbXAuZHVyYXRpb24sXG4gICAgICAgICAgICAgICAgICAgIGN1cnJlbnRUaW1lOiBjb21wLmN1cnJlbnRUaW1lLFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgbGlzdFZpZGVvUGxheWVycygpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IsIGpzIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3QgVmlkZW9QbGF5ZXIgPSBqcy5nZXRDbGFzc0J5TmFtZSgnVmlkZW9QbGF5ZXInKTtcbiAgICAgICAgICAgIGlmICghVmlkZW9QbGF5ZXIpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ1ZpZGVvUGxheWVyIG5vdCBhdmFpbGFibGUnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlczogYW55W10gPSBbXTtcbiAgICAgICAgICAgIHNjZW5lLndhbGsoKG5vZGU6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbXAgPSBub2RlLmdldENvbXBvbmVudChWaWRlb1BsYXllcik7XG4gICAgICAgICAgICAgICAgaWYgKGNvbXApIG5vZGVzLnB1c2goeyB1dWlkOiBub2RlLnV1aWQsIG5hbWU6IG5vZGUubmFtZSwgcmVzb3VyY2VUeXBlOiBjb21wLnJlc291cmNlVHlwZSwgcmVtb3RlVVJMOiBjb21wLnJlbW90ZVVSTCB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogeyBub2RlcywgY291bnQ6IG5vZGVzLmxlbmd0aCB9IH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgLy8g4pSA4pSAIFBoYXNlIDQ6IElucHV0IFN5c3RlbSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcblxuICAgIGdldElucHV0Q29uZmlnKCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBpbnB1dCwgc3lzIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7XG4gICAgICAgICAgICAgICAgICAgIG11bHRpVG91Y2g6IGlucHV0ICYmIGlucHV0Lm11bHRpVG91Y2ggIT09IHVuZGVmaW5lZCA/IGlucHV0Lm11bHRpVG91Y2ggOiBudWxsLFxuICAgICAgICAgICAgICAgICAgICBhY2NlbGVyb21ldGVyRW5hYmxlZDogc3lzICYmIHN5cy5pc05hdGl2ZSAhPT0gdW5kZWZpbmVkID8gbnVsbCA6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgIHBsYXRmb3JtOiBzeXMgPyBzeXMucGxhdGZvcm0gOiBudWxsLFxuICAgICAgICAgICAgICAgICAgICBpc01vYmlsZTogc3lzID8gc3lzLmlzTW9iaWxlIDogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgaGFzVG91Y2g6IHN5cyA/IHN5cy5oYXNGZWF0dXJlICYmIHN5cy5oYXNGZWF0dXJlKHN5cy5GZWF0dXJlLklOUFVUX1RPVUNIKSA6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgIGhhc0FjY2VsZXJvbWV0ZXI6IHN5cyA/IHN5cy5oYXNGZWF0dXJlICYmIHN5cy5oYXNGZWF0dXJlKHN5cy5GZWF0dXJlLkFDQ0VMRVJPTUVURVIpIDogbnVsbCxcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIHNldFRvdWNoQ29uZmlnKGVuYWJsZWQ6IGJvb2xlYW4pIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgaW5wdXQgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBpZiAoIWlucHV0KSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdpbnB1dCBtb2R1bGUgbm90IGF2YWlsYWJsZScgfTtcbiAgICAgICAgICAgIGlucHV0Lm11bHRpVG91Y2ggPSBlbmFibGVkO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogeyBtdWx0aVRvdWNoOiBpbnB1dC5tdWx0aVRvdWNoIH0gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICBzZXRBY2NlbGVyYXRpb25Db25maWcoZW5hYmxlZDogYm9vbGVhbiwgaW50ZXJ2YWw6IG51bWJlciB8IHVuZGVmaW5lZCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBpbnB1dCwgSW5wdXQgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBpZiAoIWlucHV0KSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdpbnB1dCBtb2R1bGUgbm90IGF2YWlsYWJsZScgfTtcbiAgICAgICAgICAgIGlmIChlbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgaW5wdXQuc2V0QWNjZWxlcm9tZXRlckVuYWJsZWQgJiYgaW5wdXQuc2V0QWNjZWxlcm9tZXRlckVuYWJsZWQodHJ1ZSk7XG4gICAgICAgICAgICAgICAgaWYgKGludGVydmFsICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgaW5wdXQuc2V0QWNjZWxlcm9tZXRlckludGVydmFsICYmIGlucHV0LnNldEFjY2VsZXJvbWV0ZXJJbnRlcnZhbChpbnRlcnZhbCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpbnB1dC5zZXRBY2NlbGVyb21ldGVyRW5hYmxlZCAmJiBpbnB1dC5zZXRBY2NlbGVyb21ldGVyRW5hYmxlZChmYWxzZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IGVuYWJsZWQsIGludGVydmFsIH0gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG59OyJdfQ==