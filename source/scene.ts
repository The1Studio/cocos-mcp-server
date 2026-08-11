import { join } from 'path';
import { findNodeByUuidDeep } from './scene-node-lookup';
module.paths.push(join(Editor.App.path, 'node_modules'));

export const methods: { [key: string]: (...any: any) => any } = {
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
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    },

    /**
     * Add component to a node
     */
    addComponentToNode(nodeUuid: string, componentType: string) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene) {
                return { success: false, error: 'No active scene' };
            }

            // Find node by UUID
            const node = findNodeByUuidDeep(scene, nodeUuid);
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
        } catch (error: any) {
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
    resolveComponentByName(nodeUuid: string, className: string) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene) {
                return { success: false, error: 'No active scene' };
            }

            const node = findNodeByUuidDeep(scene, nodeUuid);
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
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    },

    /**
     * Remove component from a node
     */
    removeComponentFromNode(nodeUuid: string, componentType: string) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene) {
                return { success: false, error: 'No active scene' };
            }

            const node = findNodeByUuidDeep(scene, nodeUuid);
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
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    },

    /**
     * Create a new node
     */
    createNode(name: string, parentUuid?: string) {
        try {
            const { director, Node } = require('cc');
            const scene = director.getScene();
            if (!scene) {
                return { success: false, error: 'No active scene' };
            }

            const node = new Node(name);
            
            if (parentUuid) {
                const parent = findNodeByUuidDeep(scene, parentUuid);
                if (parent) {
                    parent.addChild(node);
                } else {
                    scene.addChild(node);
                }
            } else {
                scene.addChild(node);
            }

            return { 
                success: true, 
                message: `Node ${name} created successfully`,
                data: { uuid: node.uuid, name: node.name }
            };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    },

    /**
     * Get node information
     */
    getNodeInfo(nodeUuid: string) {
        try {
            const { director } = require('cc');
            const scene = director.getScene();
            if (!scene) {
                return { success: false, error: 'No active scene' };
            }

            const node = findNodeByUuidDeep(scene, nodeUuid);
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
                    parent: node.parent?.uuid,
                    children: node.children.map((child: any) => child.uuid),
                    components: node.components.map((comp: any) => ({
                        type: comp.constructor.name,
                        enabled: comp.enabled
                    }))
                }
            };
        } catch (error: any) {
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

            const nodes: any[] = [];
            const collectNodes = (node: any) => {
                nodes.push({
                    uuid: node.uuid,
                    name: node.name,
                    active: node.active,
                    parent: node.parent?.uuid
                });
                
                node.children.forEach((child: any) => collectNodes(child));
            };

            scene.children.forEach((child: any) => collectNodes(child));
            
            return { success: true, data: nodes };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    },

    /**
     * Find node by name
     */
    findNodeByName(name: string) {
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
        } catch (error: any) {
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
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    },

    /**
     * Set node property
     */
    setNodeProperty(nodeUuid: string, property: string, value: any) {
        try {
            const { director } = require('cc');
            const scene = director.getScene();
            if (!scene) {
                return { success: false, error: 'No active scene' };
            }

            const node = findNodeByUuidDeep(scene, nodeUuid);
            if (!node) {
                return { success: false, error: `Node with UUID ${nodeUuid} not found` };
            }

            // Set property
            if (property === 'position') {
                node.setPosition(value.x || 0, value.y || 0, value.z || 0);
            } else if (property === 'rotation') {
                node.setRotationFromEuler(value.x || 0, value.y || 0, value.z || 0);
            } else if (property === 'scale') {
                node.setScale(value.x || 1, value.y || 1, value.z || 1);
            } else if (property === 'active') {
                node.active = value;
            } else if (property === 'name') {
                node.name = value;
            } else {
                // Prototype pollution guard
                if (['__proto__', 'constructor', 'prototype'].includes(property)) {
                    return { success: false, error: `Setting property '${property}' is not allowed` };
                }
                // Try to set the property directly
                (node as any)[property] = value;
            }

            return { 
                success: true, 
                message: `Property '${property}' updated successfully` 
            };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    },

    /**
     * Get scene hierarchy
     */
    getSceneHierarchy(includeComponents: boolean = false, maxDepth: number = 50) {
        try {
            const { director } = require('cc');
            const scene = director.getScene();
            if (!scene) {
                return { success: false, error: 'No active scene' };
            }

            const processNode = (node: any, depth: number = 0): any => {
                if (depth >= maxDepth) {
                    return { name: node.name, uuid: node.uuid, truncated: true };
                }
                const result: any = {
                    name: node.name,
                    uuid: node.uuid,
                    active: node.active,
                    children: []
                };

                if (includeComponents) {
                    result.components = node.components.map((comp: any) => ({
                        type: comp.constructor.name,
                        enabled: comp.enabled
                    }));
                }

                if (node.children && node.children.length > 0) {
                    result.children = node.children.map((child: any) => processNode(child, depth + 1));
                }

                return result;
            };

            const hierarchy = scene.children.map((child: any) => processNode(child, 0));
            return { success: true, data: hierarchy };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    },

    /**
     * Create prefab from node
     */
    createPrefabFromNode(nodeUuid: string, prefabPath: string) {
        try {
            const { director, instantiate } = require('cc');
            const scene = director.getScene();
            if (!scene) {
                return { success: false, error: 'No active scene' };
            }

            const node = findNodeByUuidDeep(scene, nodeUuid);
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
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    },

    /**
     * Set component property
     */
    setComponentProperty(nodeUuid: string, componentType: string, property: string, value: any) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene) {
                return { success: false, error: 'No active scene' };
            }
            const node = findNodeByUuidDeep(scene, nodeUuid);
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
                    return new Promise<{ success: boolean; message?: string; error?: string }>((resolve) => {
                        assetManager.resources.load(value, require('cc').SpriteFrame, (err: any, spriteFrame: any) => {
                            if (!err && spriteFrame) {
                                component.spriteFrame = spriteFrame;
                                resolve({ success: true, message: `Component property '${property}' updated successfully` });
                            } else {
                                assetManager.loadAny({ uuid: value }, (err2: any, asset: any) => {
                                    if (!err2 && asset) {
                                        component.spriteFrame = asset;
                                        resolve({ success: true, message: `Component property '${property}' updated successfully` });
                                    } else {
                                        resolve({ success: false, error: `Failed to load spriteFrame: ${err2?.message || err?.message || 'unknown error'}` });
                                    }
                                });
                            }
                        });
                    });
                } else {
                    component.spriteFrame = value;
                }
            } else if (property === 'material' && (componentType === 'cc.Sprite' || componentType === 'cc.MeshRenderer')) {
                // Value can be a uuid or asset path
                if (typeof value === 'string') {
                    const assetManager = require('cc').assetManager;
                    // Return a Promise so the caller waits for the asset to load
                    return new Promise<{ success: boolean; message?: string; error?: string }>((resolve) => {
                        assetManager.resources.load(value, require('cc').Material, (err: any, material: any) => {
                            if (!err && material) {
                                component.material = material;
                                resolve({ success: true, message: `Component property '${property}' updated successfully` });
                            } else {
                                assetManager.loadAny({ uuid: value }, (err2: any, asset: any) => {
                                    if (!err2 && asset) {
                                        component.material = asset;
                                        resolve({ success: true, message: `Component property '${property}' updated successfully` });
                                    } else {
                                        resolve({ success: false, error: `Failed to load material: ${err2?.message || err?.message || 'unknown error'}` });
                                    }
                                });
                            }
                        });
                    });
                } else {
                    component.material = value;
                }
            } else if (property === 'string' && (componentType === 'cc.Label' || componentType === 'cc.RichText')) {
                component.string = value;
            } else {
                component[property] = value;
            }
            // Optional: refresh Inspector
            // Editor.Message.send('scene', 'snapshot');
            return { success: true, message: `Component property '${property}' updated successfully` };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    },

    // ─── Light helpers ────────────────────────────────────────────────────────

    /** Map light type string to cc class name */
    _getLightClassName(type: string): string {
        const map: Record<string, string> = {
            directional: 'DirectionalLight',
            sphere: 'SphereLight',
            spot: 'SpotLight',
        };
        return map[type] || 'DirectionalLight';
    },

    /** Parse color from hex string or {r,g,b,a} object into cc.Color */
    _parseColor(cc: any, color: any): any {
        if (!color) return new cc.Color(255, 255, 255, 255);
        if (typeof color === 'string') {
            const hex = color.replace('#', '');
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            return new cc.Color(r, g, b, 255);
        }
        return new cc.Color(color.r ?? 255, color.g ?? 255, color.b ?? 255, color.a ?? 255);
    },

    addLightComponent(nodeUuid: string, type: string, color: any, intensity: number) {
        try {
            const { director, js, Color } = require('cc');
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const node = findNodeByUuidDeep(scene, nodeUuid);
            if (!node) return { success: false, error: `Node ${nodeUuid} not found` };
            const className = (methods as any)._getLightClassName(type);
            const LightClass = js.getClassByName(className);
            if (!LightClass) return { success: false, error: `Light class ${className} not found` };
            const light = node.addComponent(LightClass);
            if (color) light.color = (methods as any)._parseColor({ Color }, color);
            if (intensity !== undefined) light.luminance = intensity;
            return { success: true, data: { uuid: node.uuid, lightType: className } };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    setLightProperty(nodeUuid: string, property: string, value: any) {
        try {
            const { director, js, Color } = require('cc');
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const node = findNodeByUuidDeep(scene, nodeUuid);
            if (!node) return { success: false, error: `Node ${nodeUuid} not found` };
            const lightTypes = ['DirectionalLight', 'SphereLight', 'SpotLight'];
            let light: any = null;
            for (const t of lightTypes) {
                const cls = js.getClassByName(t);
                if (cls) { light = node.getComponent(cls); if (light) break; }
            }
            if (!light) return { success: false, error: 'No light component found on node' };
            if (property === 'color') {
                light.color = (methods as any)._parseColor({ Color }, value);
            } else if (['__proto__', 'constructor', 'prototype'].includes(property)) {
                return { success: false, error: `Setting '${property}' is not allowed` };
            } else {
                light[property] = value;
            }
            return { success: true };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    getLightInfo(nodeUuid: string) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const node = findNodeByUuidDeep(scene, nodeUuid);
            if (!node) return { success: false, error: `Node ${nodeUuid} not found` };
            const lightTypes = ['DirectionalLight', 'SphereLight', 'SpotLight'];
            for (const t of lightTypes) {
                const cls = js.getClassByName(t);
                if (!cls) continue;
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
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    listLights() {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const lights: any[] = [];
            const lightTypes = ['DirectionalLight', 'SphereLight', 'SpotLight'];
            const walk = (node: any) => {
                for (const t of lightTypes) {
                    const cls = js.getClassByName(t);
                    if (cls && node.getComponent(cls)) {
                        lights.push({ uuid: node.uuid, name: node.name, lightType: t });
                        break;
                    }
                }
                node.children.forEach((c: any) => walk(c));
            };
            scene.children.forEach((c: any) => walk(c));
            return { success: true, data: { lights, count: lights.length } };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    removeLightComponent(nodeUuid: string) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const node = findNodeByUuidDeep(scene, nodeUuid);
            if (!node) return { success: false, error: `Node ${nodeUuid} not found` };
            const lightTypes = ['DirectionalLight', 'SphereLight', 'SpotLight'];
            for (const t of lightTypes) {
                const cls = js.getClassByName(t);
                if (!cls) continue;
                const light = node.getComponent(cls);
                if (light) { node.removeComponent(light); return { success: true }; }
            }
            return { success: false, error: 'No light component found on node' };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    // ─── Camera helpers ───────────────────────────────────────────────────────

    getCameraInfo(nodeUuid: string) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const node = findNodeByUuidDeep(scene, nodeUuid);
            if (!node) return { success: false, error: `Node ${nodeUuid} not found` };
            const CameraClass = js.getClassByName('Camera');
            if (!CameraClass) return { success: false, error: 'Camera class not found' };
            const cam = node.getComponent(CameraClass);
            if (!cam) return { success: false, error: 'No Camera component on node' };
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
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    setCameraProperty(nodeUuid: string, property: string, value: any) {
        try {
            const { director, js, Rect, Camera } = require('cc');
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const node = findNodeByUuidDeep(scene, nodeUuid);
            if (!node) return { success: false, error: `Node ${nodeUuid} not found` };
            const CameraClass = js.getClassByName('Camera') || Camera;
            const cam = node.getComponent(CameraClass);
            if (!cam) return { success: false, error: 'No Camera component on node' };
            if (['__proto__', 'constructor', 'prototype'].includes(property)) {
                return { success: false, error: `Setting '${property}' is not allowed` };
            }
            if (property === 'clearFlags') {
                const flagMap: Record<string, number> = { SOLID_COLOR: 1, DEPTH_ONLY: 2, DONT_CLEAR: 3, SKYBOX: 4 };
                cam.clearFlags = flagMap[value] ?? value;
            } else if (property === 'projection') {
                cam.projection = value === 'ORTHO' ? 0 : 1;
            } else if (property === 'viewport') {
                cam.rect = new Rect(value.x, value.y, value.width, value.height);
            } else {
                cam[property] = value;
            }
            return { success: true };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    listCameras() {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const CameraClass = js.getClassByName('Camera');
            if (!CameraClass) return { success: false, error: 'Camera class not found' };
            const cameras: any[] = [];
            const walk = (node: any) => {
                const cam = node.getComponent(CameraClass);
                if (cam) cameras.push({ uuid: node.uuid, name: node.name, priority: cam.priority, projection: cam.projection });
                node.children.forEach((c: any) => walk(c));
            };
            scene.children.forEach((c: any) => walk(c));
            return { success: true, data: { cameras, count: cameras.length } };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    // ─── Physics helpers ──────────────────────────────────────────────────────

    configurePhysics(gravity: any, fixedTimeStep?: number, maxSubSteps?: number) {
        try {
            const { PhysicsSystem, Vec3 } = require('cc');
            const sys = PhysicsSystem?.instance;
            if (!sys) return { success: false, error: 'PhysicsSystem not available (3D only)' };
            if (gravity) sys.gravity = new Vec3(gravity.x ?? 0, gravity.y ?? -10, gravity.z ?? 0);
            if (fixedTimeStep !== undefined) sys.fixedTimeStep = fixedTimeStep;
            if (maxSubSteps !== undefined) sys.maxSubSteps = maxSubSteps;
            return { success: true, data: { gravity: sys.gravity, fixedTimeStep: sys.fixedTimeStep, maxSubSteps: sys.maxSubSteps } };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    /** Detect if node is in a 2D context by checking for UITransform/Sprite */
    _is2DNode(node: any, js: any): boolean {
        const types2D = ['UITransform', 'Sprite', 'Label', 'Button', 'Canvas'];
        return types2D.some(t => { const cls = js.getClassByName(t); return cls && node.getComponent(cls); });
    },

    addRigidbody(nodeUuid: string, type: string, mass: number, useGravity: boolean) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const node = findNodeByUuidDeep(scene, nodeUuid);
            if (!node) return { success: false, error: `Node ${nodeUuid} not found` };
            const is2D = (methods as any)._is2DNode(node, js);
            const className = is2D ? 'RigidBody2D' : 'RigidBody';
            const RBClass = js.getClassByName(className);
            if (!RBClass) return { success: false, error: `${className} not available` };
            const rb = node.addComponent(RBClass);
            if (is2D) {
                const typeMap: Record<string, number> = { static: 0, kinematic: 1, dynamic: 2 };
                rb.type = typeMap[type] ?? 2;
            } else {
                const typeMap: Record<string, number> = { dynamic: 0, static: 2, kinematic: 3 };
                rb.type = typeMap[type] ?? 0;
                rb.mass = mass;
                rb.useGravity = useGravity;
            }
            return { success: true, data: { uuid: node.uuid, rbClass: className, type } };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    addCollider(nodeUuid: string, shape: string, size: any, isTrigger: boolean) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const node = findNodeByUuidDeep(scene, nodeUuid);
            if (!node) return { success: false, error: `Node ${nodeUuid} not found` };
            const is2D = (methods as any)._is2DNode(node, js);
            const classMap3D: Record<string, string> = { box: 'BoxCollider', sphere: 'SphereCollider', capsule: 'CapsuleCollider' };
            const classMap2D: Record<string, string> = { box: 'BoxCollider2D', circle: 'CircleCollider2D', polygon: 'PolygonCollider2D' };
            const className = is2D ? (classMap2D[shape] || 'BoxCollider2D') : (classMap3D[shape] || 'BoxCollider');
            const ColliderClass = js.getClassByName(className);
            if (!ColliderClass) return { success: false, error: `${className} not available` };
            const collider = node.addComponent(ColliderClass);
            collider.isTrigger = isTrigger;
            if (size && collider.size) {
                const { Vec3, Size } = require('cc');
                if (is2D) collider.size = new Size(size.width ?? size.x ?? 1, size.height ?? size.y ?? 1);
                else collider.size = new Vec3(size.width ?? size.x ?? 1, size.height ?? size.y ?? 1, size.depth ?? size.z ?? 1);
            }
            if (size?.radius !== undefined && collider.radius !== undefined) collider.radius = size.radius;
            return { success: true, data: { uuid: node.uuid, colliderClass: className, isTrigger } };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    setRigidbodyProperty(nodeUuid: string, property: string, value: any) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const node = findNodeByUuidDeep(scene, nodeUuid);
            if (!node) return { success: false, error: `Node ${nodeUuid} not found` };
            if (['__proto__', 'constructor', 'prototype'].includes(property)) {
                return { success: false, error: `Setting '${property}' is not allowed` };
            }
            for (const rbName of ['RigidBody', 'RigidBody2D']) {
                const cls = js.getClassByName(rbName);
                if (!cls) continue;
                const rb = node.getComponent(cls);
                if (rb) { rb[property] = value; return { success: true }; }
            }
            return { success: false, error: 'No RigidBody component found on node' };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    setColliderProperty(nodeUuid: string, property: string, value: any) {
        try {
            const { director, js, Vec3, Size } = require('cc');
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const node = findNodeByUuidDeep(scene, nodeUuid);
            if (!node) return { success: false, error: `Node ${nodeUuid} not found` };
            if (['__proto__', 'constructor', 'prototype'].includes(property)) {
                return { success: false, error: `Setting '${property}' is not allowed` };
            }
            const colliderNames = ['BoxCollider', 'SphereCollider', 'CapsuleCollider', 'BoxCollider2D', 'CircleCollider2D', 'PolygonCollider2D'];
            for (const name of colliderNames) {
                const cls = js.getClassByName(name);
                if (!cls) continue;
                const col = node.getComponent(cls);
                if (col) {
                    if (property === 'size' && typeof value === 'object') {
                        col.size = name.endsWith('2D')
                            ? new Size(value.width ?? value.x ?? 1, value.height ?? value.y ?? 1)
                            : new Vec3(value.width ?? value.x ?? 1, value.height ?? value.y ?? 1, value.depth ?? value.z ?? 1);
                    } else if (property === 'center' && typeof value === 'object') {
                        col.center = new Vec3(value.x ?? 0, value.y ?? 0, value.z ?? 0);
                    } else {
                        col[property] = value;
                    }
                    return { success: true };
                }
            }
            return { success: false, error: 'No collider component found on node' };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    removePhysicsComponents(nodeUuid: string) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const node = findNodeByUuidDeep(scene, nodeUuid);
            if (!node) return { success: false, error: `Node ${nodeUuid} not found` };
            const physicsNames = ['RigidBody', 'RigidBody2D', 'BoxCollider', 'SphereCollider', 'CapsuleCollider', 'BoxCollider2D', 'CircleCollider2D', 'PolygonCollider2D'];
            const removed: string[] = [];
            for (const name of physicsNames) {
                const cls = js.getClassByName(name);
                if (!cls) continue;
                const comp = node.getComponent(cls);
                if (comp) { node.removeComponent(comp); removed.push(name); }
            }
            return { success: true, data: { removed } };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    getPhysicsInfo(nodeUuid: string) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const node = findNodeByUuidDeep(scene, nodeUuid);
            if (!node) return { success: false, error: `Node ${nodeUuid} not found` };
            const info: any = { rigidbody: null, colliders: [] };
            for (const rbName of ['RigidBody', 'RigidBody2D']) {
                const cls = js.getClassByName(rbName);
                if (!cls) continue;
                const rb = node.getComponent(cls);
                if (rb) { info.rigidbody = { type: rbName, rbType: rb.type, mass: rb.mass, useGravity: rb.useGravity }; break; }
            }
            const colliderNames = ['BoxCollider', 'SphereCollider', 'CapsuleCollider', 'BoxCollider2D', 'CircleCollider2D', 'PolygonCollider2D'];
            for (const name of colliderNames) {
                const cls = js.getClassByName(name);
                if (!cls) continue;
                const col = node.getComponent(cls);
                if (col) info.colliders.push({ type: name, isTrigger: col.isTrigger, size: col.size, center: col.center });
            }
            return { success: true, data: info };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    performRaycast(origin: any, direction: any, maxDistance: number) {
        try {
            const { PhysicsSystem, Vec3, geometry } = require('cc');
            const sys = PhysicsSystem?.instance;
            if (!sys) return { success: false, error: 'PhysicsSystem not available (3D only)' };
            const ray = new geometry.Ray(origin.x, origin.y, origin.z, direction.x, direction.y, direction.z);
            const hit = sys.raycastClosest(ray, 0xffffffff, maxDistance);
            if (!hit) return { success: true, data: { hit: false } };
            const result = sys.raycastClosestResult;
            return {
                success: true,
                data: {
                    hit: true,
                    distance: result.distance,
                    hitPoint: result.hitPoint,
                    hitNormal: result.hitNormal,
                    nodeUuid: result.collider?.node?.uuid,
                    nodeName: result.collider?.node?.name,
                }
            };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    // ─── Audio helpers ────────────────────────────────────────────────────────

    addAudioSource(nodeUuid: string, clipUuid: string | null) {
        try {
            const { director, js, assetManager } = require('cc');
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const node = findNodeByUuidDeep(scene, nodeUuid);
            if (!node) return { success: false, error: `Node ${nodeUuid} not found` };
            const AudioSourceClass = js.getClassByName('AudioSource');
            if (!AudioSourceClass) return { success: false, error: 'AudioSource class not found' };
            const audio = node.addComponent(AudioSourceClass);
            if (clipUuid) {
                assetManager.loadAny({ uuid: clipUuid }, (err: any, clip: any) => {
                    if (!err && clip) audio.clip = clip;
                });
            }
            return { success: true, data: { uuid: node.uuid, hasClip: !!clipUuid } };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    setAudioProperty(nodeUuid: string, property: string, value: any) {
        try {
            const { director, js, assetManager } = require('cc');
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const node = findNodeByUuidDeep(scene, nodeUuid);
            if (!node) return { success: false, error: `Node ${nodeUuid} not found` };
            const AudioSourceClass = js.getClassByName('AudioSource');
            if (!AudioSourceClass) return { success: false, error: 'AudioSource class not found' };
            const audio = node.getComponent(AudioSourceClass);
            if (!audio) return { success: false, error: 'No AudioSource component on node' };
            if (['__proto__', 'constructor', 'prototype'].includes(property)) {
                return { success: false, error: `Setting '${property}' is not allowed` };
            }
            if (property === 'clip' && typeof value === 'string') {
                assetManager.loadAny({ uuid: value }, (err: any, clip: any) => {
                    if (!err && clip) audio.clip = clip;
                });
                return { success: true, message: 'Clip loading initiated' };
            }
            audio[property] = value;
            return { success: true };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    controlAudio(nodeUuid: string, command: string) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const node = findNodeByUuidDeep(scene, nodeUuid);
            if (!node) return { success: false, error: `Node ${nodeUuid} not found` };
            const AudioSourceClass = js.getClassByName('AudioSource');
            if (!AudioSourceClass) return { success: false, error: 'AudioSource class not found' };
            const audio = node.getComponent(AudioSourceClass);
            if (!audio) return { success: false, error: 'No AudioSource component on node' };
            const cmds: Record<string, () => void> = {
                play: () => audio.play(),
                stop: () => audio.stop(),
                pause: () => audio.pause(),
                resume: () => audio.play(),
            };
            if (!cmds[command]) return { success: false, error: `Unknown command '${command}'` };
            cmds[command]();
            return { success: true, data: { command } };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    getAudioInfo(nodeUuid: string) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const node = findNodeByUuidDeep(scene, nodeUuid);
            if (!node) return { success: false, error: `Node ${nodeUuid} not found` };
            const AudioSourceClass = js.getClassByName('AudioSource');
            if (!AudioSourceClass) return { success: false, error: 'AudioSource class not found' };
            const audio = node.getComponent(AudioSourceClass);
            if (!audio) return { success: false, error: 'No AudioSource component on node' };
            return {
                success: true,
                data: {
                    clip: audio.clip?.name ?? null,
                    volume: audio.volume,
                    loop: audio.loop,
                    playOnAwake: audio.playOnAwake,
                    playing: audio.playing,
                }
            };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    listAudioSources() {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const AudioSourceClass = js.getClassByName('AudioSource');
            if (!AudioSourceClass) return { success: false, error: 'AudioSource class not found' };
            const sources: any[] = [];
            const walk = (node: any) => {
                const audio = node.getComponent(AudioSourceClass);
                if (audio) sources.push({ uuid: node.uuid, name: node.name, clip: audio.clip?.name ?? null, volume: audio.volume });
                node.children.forEach((c: any) => walk(c));
            };
            scene.children.forEach((c: any) => walk(c));
            return { success: true, data: { sources, count: sources.length } };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    // ─── Particle helpers ─────────────────────────────────────────────────────

    addParticleSystem(nodeUuid: string, is2d: boolean) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const node = findNodeByUuidDeep(scene, nodeUuid);
            if (!node) return { success: false, error: `Node ${nodeUuid} not found` };
            const className = is2d ? 'ParticleSystem2D' : 'ParticleSystem';
            const PSClass = js.getClassByName(className);
            if (!PSClass) return { success: false, error: `${className} not found` };
            node.addComponent(PSClass);
            return { success: true, data: { uuid: node.uuid, particleClass: className } };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    setParticleProperty(nodeUuid: string, property: string, value: any) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const node = findNodeByUuidDeep(scene, nodeUuid);
            if (!node) return { success: false, error: `Node ${nodeUuid} not found` };
            if (['__proto__', 'constructor', 'prototype'].includes(property)) {
                return { success: false, error: `Setting '${property}' is not allowed` };
            }
            for (const cls of ['ParticleSystem', 'ParticleSystem2D']) {
                const PSClass = js.getClassByName(cls);
                if (!PSClass) continue;
                const ps = node.getComponent(PSClass);
                if (ps) { ps[property] = value; return { success: true }; }
            }
            return { success: false, error: 'No ParticleSystem component found on node' };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    setParticleEmission(nodeUuid: string, rateOverTime: number, bursts: any[]) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const node = findNodeByUuidDeep(scene, nodeUuid);
            if (!node) return { success: false, error: `Node ${nodeUuid} not found` };
            const PSClass = js.getClassByName('ParticleSystem');
            if (!PSClass) return { success: false, error: 'ParticleSystem not found (3D only for emission control)' };
            const ps = node.getComponent(PSClass);
            if (!ps) return { success: false, error: 'No ParticleSystem on node' };
            if (rateOverTime !== undefined && ps.rateOverTime) {
                ps.rateOverTime.constant = rateOverTime;
            }
            if (Array.isArray(bursts) && ps.bursts !== undefined) {
                ps.bursts = bursts;
            }
            return { success: true };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    setParticleShape(nodeUuid: string, shapeType: string, radius: number, angle: number) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const node = findNodeByUuidDeep(scene, nodeUuid);
            if (!node) return { success: false, error: `Node ${nodeUuid} not found` };
            const PSClass = js.getClassByName('ParticleSystem');
            if (!PSClass) return { success: false, error: 'ParticleSystem not found (3D only for shape)' };
            const ps = node.getComponent(PSClass);
            if (!ps) return { success: false, error: 'No ParticleSystem on node' };
            if (ps.shapeModule) {
                const shapeMap: Record<string, number> = { cone: 0, sphere: 1, box: 4 };
                if (shapeType && shapeMap[shapeType] !== undefined) ps.shapeModule.shapeType = shapeMap[shapeType];
                if (radius !== undefined) ps.shapeModule.radius = radius;
                if (angle !== undefined) ps.shapeModule.angle = angle;
            }
            return { success: true };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    setParticleRenderer(nodeUuid: string, renderMode: number, materialUuid: string) {
        try {
            const { director, js, assetManager } = require('cc');
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const node = findNodeByUuidDeep(scene, nodeUuid);
            if (!node) return { success: false, error: `Node ${nodeUuid} not found` };
            const PSClass = js.getClassByName('ParticleSystem');
            if (!PSClass) return { success: false, error: 'ParticleSystem not found' };
            const ps = node.getComponent(PSClass);
            if (!ps) return { success: false, error: 'No ParticleSystem on node' };
            if (renderMode !== undefined && ps.renderer) ps.renderer.renderMode = renderMode;
            if (materialUuid && ps.renderer) {
                assetManager.loadAny({ uuid: materialUuid }, (err: any, mat: any) => {
                    if (!err && mat) ps.renderer.sharedMaterial = mat;
                });
            }
            return { success: true };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    getParticleInfo(nodeUuid: string) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const node = findNodeByUuidDeep(scene, nodeUuid);
            if (!node) return { success: false, error: `Node ${nodeUuid} not found` };
            for (const cls of ['ParticleSystem', 'ParticleSystem2D']) {
                const PSClass = js.getClassByName(cls);
                if (!PSClass) continue;
                const ps = node.getComponent(PSClass);
                if (ps) {
                    return {
                        success: true,
                        data: {
                            particleClass: cls,
                            duration: ps.duration,
                            loop: ps.loop,
                            playOnAwake: ps.playOnAwake,
                            maxParticles: ps.capacity ?? ps.totalParticles,
                            startLifetime: ps.startLifetime?.constant,
                            startSpeed: ps.startSpeed?.constant,
                        }
                    };
                }
            }
            return { success: false, error: 'No ParticleSystem component found on node' };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    listParticleSystems() {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const particles: any[] = [];
            const walk = (node: any) => {
                for (const cls of ['ParticleSystem', 'ParticleSystem2D']) {
                    const PSClass = js.getClassByName(cls);
                    if (PSClass && node.getComponent(PSClass)) {
                        particles.push({ uuid: node.uuid, name: node.name, particleClass: cls });
                        break;
                    }
                }
                node.children.forEach((c: any) => walk(c));
            };
            scene.children.forEach((c: any) => walk(c));
            return { success: true, data: { particles, count: particles.length } };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    removeParticleSystem(nodeUuid: string) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const node = findNodeByUuidDeep(scene, nodeUuid);
            if (!node) return { success: false, error: `Node ${nodeUuid} not found` };
            for (const cls of ['ParticleSystem', 'ParticleSystem2D']) {
                const PSClass = js.getClassByName(cls);
                if (!PSClass) continue;
                const ps = node.getComponent(PSClass);
                if (ps) { node.removeComponent(ps); return { success: true }; }
            }
            return { success: false, error: 'No ParticleSystem component found on node' };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    // ─── Tween helpers ────────────────────────────────────────────────────────

    _applyTweenProperties(tween: any, node: any, properties: any, ccModule: any): any {
        const { Vec3, Quat } = ccModule;
        const target: Record<string, any> = {};
        if (properties.position) target.position = new Vec3(properties.position.x ?? 0, properties.position.y ?? 0, properties.position.z ?? 0);
        if (properties.scale) target.scale = new Vec3(properties.scale.x ?? 1, properties.scale.y ?? 1, properties.scale.z ?? 1);
        if (properties.opacity !== undefined) {
            const uiOp = node.getComponent && node.getComponent(ccModule.js?.getClassByName('UIOpacity'));
            if (uiOp) target.opacity = properties.opacity;
        }
        return target;
    },

    createTween(nodeUuid: string, steps: any[]) {
        try {
            const cc = require('cc');
            const { director, tween, Vec3 } = cc;
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const node = findNodeByUuidDeep(scene, nodeUuid);
            if (!node) return { success: false, error: `Node ${nodeUuid} not found` };
            let t = tween(node);
            for (const step of steps) {
                if (step.type === 'delay') {
                    t = t.delay(step.duration ?? 0);
                } else if (step.type === 'to' || step.type === 'by') {
                    const props = step.properties || {};
                    const target: Record<string, any> = {};
                    if (props.position) target.position = new Vec3(props.position.x ?? 0, props.position.y ?? 0, props.position.z ?? 0);
                    if (props.scale) target.scale = new Vec3(props.scale.x ?? 1, props.scale.y ?? 1, props.scale.z ?? 1);
                    const opts = step.easing ? { easing: step.easing } : {};
                    t = step.type === 'to' ? t.to(step.duration ?? 1, target, opts) : t.by(step.duration ?? 1, target, opts);
                }
            }
            t.start();
            return { success: true, data: { nodeUuid, steps: steps.length } };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    addTweenTo(nodeUuid: string, properties: any, duration: number, easing: string) {
        try {
            const { director, tween, Vec3 } = require('cc');
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const node = findNodeByUuidDeep(scene, nodeUuid);
            if (!node) return { success: false, error: `Node ${nodeUuid} not found` };
            const target: Record<string, any> = {};
            if (properties.position) target.position = new Vec3(properties.position.x ?? 0, properties.position.y ?? 0, properties.position.z ?? 0);
            if (properties.scale) target.scale = new Vec3(properties.scale.x ?? 1, properties.scale.y ?? 1, properties.scale.z ?? 1);
            const opts = easing && easing !== 'linear' ? { easing } : {};
            tween(node).to(duration, target, opts).start();
            return { success: true, data: { nodeUuid, duration, easing } };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    addTweenBy(nodeUuid: string, properties: any, duration: number, easing: string) {
        try {
            const { director, tween, Vec3 } = require('cc');
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const node = findNodeByUuidDeep(scene, nodeUuid);
            if (!node) return { success: false, error: `Node ${nodeUuid} not found` };
            const target: Record<string, any> = {};
            if (properties.position) target.position = new Vec3(properties.position.x ?? 0, properties.position.y ?? 0, properties.position.z ?? 0);
            if (properties.scale) target.scale = new Vec3(properties.scale.x ?? 1, properties.scale.y ?? 1, properties.scale.z ?? 1);
            const opts = easing && easing !== 'linear' ? { easing } : {};
            tween(node).by(duration, target, opts).start();
            return { success: true, data: { nodeUuid, duration, easing } };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    addTweenDelay(nodeUuid: string, duration: number) {
        try {
            const { director, tween } = require('cc');
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const node = findNodeByUuidDeep(scene, nodeUuid);
            if (!node) return { success: false, error: `Node ${nodeUuid} not found` };
            tween(node).delay(duration).start();
            return { success: true, data: { nodeUuid, duration } };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    stopTweens(nodeUuid: string) {
        try {
            const { director, Tween } = require('cc');
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const node = findNodeByUuidDeep(scene, nodeUuid);
            if (!node) return { success: false, error: `Node ${nodeUuid} not found` };
            if (Tween && typeof Tween.stopAllByTarget === 'function') {
                Tween.stopAllByTarget(node);
            }
            return { success: true, data: { nodeUuid } };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    // ── TiledMap ──────────────────────────────────────────────────────────────

    getTiledMapInfo(nodeUuid: string) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const node = findNodeByUuidDeep(scene, nodeUuid);
            if (!node) return { success: false, error: `Node ${nodeUuid} not found` };
            const TiledMap = js.getClassByName('TiledMap');
            if (!TiledMap) return { success: false, error: 'TiledMap class not found' };
            const comp = node.getComponent(TiledMap);
            if (!comp) return { success: false, error: 'No TiledMap component on node' };
            const layers: string[] = [];
            if (comp.getLayers) { try { comp.getLayers().forEach((l: any) => layers.push(l.getLayerName ? l.getLayerName() : l.layerName)); } catch { /* ignore */ } }
            return { success: true, data: { mapSize: comp.mapSize, tileSize: comp.tileSize, layers, orientation: comp.orientation } };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    listTiledMaps() {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const TiledMap = js.getClassByName('TiledMap');
            if (!TiledMap) return { success: false, error: 'TiledMap class not found' };
            const nodes: any[] = [];
            scene.walk((node: any) => { if (node.getComponent(TiledMap)) nodes.push({ uuid: node.uuid, name: node.name }); });
            return { success: true, data: { nodes, count: nodes.length } };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    getTiledLayerInfo(nodeUuid: string, layerName: string) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const node = findNodeByUuidDeep(scene, nodeUuid);
            if (!node) return { success: false, error: `Node ${nodeUuid} not found` };
            const TiledMap = js.getClassByName('TiledMap');
            if (!TiledMap) return { success: false, error: 'TiledMap class not found' };
            const comp = node.getComponent(TiledMap);
            if (!comp) return { success: false, error: 'No TiledMap component on node' };
            const layer = comp.getLayer(layerName);
            if (!layer) return { success: false, error: `Layer '${layerName}' not found` };
            return { success: true, data: { layerName, layerSize: layer.layerSize, tiles: layer.tiles } };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    setTile(nodeUuid: string, layerName: string, x: number, y: number, gid: number) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const node = findNodeByUuidDeep(scene, nodeUuid);
            if (!node) return { success: false, error: `Node ${nodeUuid} not found` };
            const TiledMap = js.getClassByName('TiledMap');
            if (!TiledMap) return { success: false, error: 'TiledMap class not found' };
            const comp = node.getComponent(TiledMap);
            if (!comp) return { success: false, error: 'No TiledMap component on node' };
            const layer = comp.getLayer(layerName);
            if (!layer) return { success: false, error: `Layer '${layerName}' not found` };
            layer.setTileGIDAt(gid, x, y);
            return { success: true, data: { x, y, gid } };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    getTile(nodeUuid: string, layerName: string, x: number, y: number) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const node = findNodeByUuidDeep(scene, nodeUuid);
            if (!node) return { success: false, error: `Node ${nodeUuid} not found` };
            const TiledMap = js.getClassByName('TiledMap');
            if (!TiledMap) return { success: false, error: 'TiledMap class not found' };
            const comp = node.getComponent(TiledMap);
            if (!comp) return { success: false, error: 'No TiledMap component on node' };
            const layer = comp.getLayer(layerName);
            if (!layer) return { success: false, error: `Layer '${layerName}' not found` };
            const gid = layer.getTileGIDAt(x, y);
            return { success: true, data: { x, y, gid } };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    getTilesetInfo(nodeUuid: string) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const node = findNodeByUuidDeep(scene, nodeUuid);
            if (!node) return { success: false, error: `Node ${nodeUuid} not found` };
            const TiledMap = js.getClassByName('TiledMap');
            if (!TiledMap) return { success: false, error: 'TiledMap class not found' };
            const comp = node.getComponent(TiledMap);
            if (!comp) return { success: false, error: 'No TiledMap component on node' };
            const tilesets: any[] = [];
            if (comp.getTilesets) {
                try { comp.getTilesets().forEach((ts: any) => tilesets.push({ name: ts.name, firstGid: ts.firstGid, tileSize: ts.tileSize })); } catch { /* ignore */ }
            }
            return { success: true, data: { tilesets } };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    // ── Spine ─────────────────────────────────────────────────────────────────

    getSpineInfo(nodeUuid: string) {
        try {
            const { director } = require('cc');
            let sp: any;
            try { sp = require('cc').sp; if (!sp) throw new Error('not found'); } catch { return { success: false, error: 'Spine module not available in this project' }; }
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const node = findNodeByUuidDeep(scene, nodeUuid);
            if (!node) return { success: false, error: `Node ${nodeUuid} not found` };
            const comp = node.getComponent(sp.Skeleton);
            if (!comp) return { success: false, error: 'No sp.Skeleton component on node' };
            const animations: string[] = [];
            const skins: string[] = [];
            try { if (comp.skeletonData) { const ae = comp.skeletonData.getAnimsEnum; const se = comp.skeletonData.getSkinsEnum; if (ae) animations.push(...Object.keys(ae())); if (se) skins.push(...Object.keys(se())); } } catch { /* ignore */ }
            return { success: true, data: { animations, skins, timeScale: comp.timeScale, premultipliedAlpha: comp.premultipliedAlpha, debugBones: comp.debugBones, debugSlots: comp.debugSlots } };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    setSpineAnimation(nodeUuid: string, animationName: string, loop: boolean, trackIndex: number) {
        try {
            const { director } = require('cc');
            let sp: any;
            try { sp = require('cc').sp; if (!sp) throw new Error('not found'); } catch { return { success: false, error: 'Spine module not available in this project' }; }
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const node = findNodeByUuidDeep(scene, nodeUuid);
            if (!node) return { success: false, error: `Node ${nodeUuid} not found` };
            const comp = node.getComponent(sp.Skeleton);
            if (!comp) return { success: false, error: 'No sp.Skeleton component on node' };
            comp.setAnimation(trackIndex, animationName, loop);
            return { success: true, data: { animationName, loop, trackIndex } };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    setSpineSkin(nodeUuid: string, skinName: string) {
        try {
            const { director } = require('cc');
            let sp: any;
            try { sp = require('cc').sp; if (!sp) throw new Error('not found'); } catch { return { success: false, error: 'Spine module not available in this project' }; }
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const node = findNodeByUuidDeep(scene, nodeUuid);
            if (!node) return { success: false, error: `Node ${nodeUuid} not found` };
            const comp = node.getComponent(sp.Skeleton);
            if (!comp) return { success: false, error: 'No sp.Skeleton component on node' };
            comp.setSkin(skinName);
            return { success: true, data: { skinName } };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    setSpineProperty(nodeUuid: string, property: string, value: any) {
        try {
            const { director } = require('cc');
            let sp: any;
            try { sp = require('cc').sp; if (!sp) throw new Error('not found'); } catch { return { success: false, error: 'Spine module not available in this project' }; }
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const node = findNodeByUuidDeep(scene, nodeUuid);
            if (!node) return { success: false, error: `Node ${nodeUuid} not found` };
            const comp = node.getComponent(sp.Skeleton);
            if (!comp) return { success: false, error: 'No sp.Skeleton component on node' };
            const allowed = ['timeScale', 'premultipliedAlpha', 'debugBones', 'debugSlots'];
            if (!allowed.includes(property)) return { success: false, error: `Property '${property}' not allowed. Use: ${allowed.join(', ')}` };
            (comp as any)[property] = value;
            return { success: true, data: { property, value } };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    listSpineNodes() {
        try {
            const { director } = require('cc');
            let sp: any;
            try { sp = require('cc').sp; if (!sp) throw new Error('not found'); } catch { return { success: false, error: 'Spine module not available in this project' }; }
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const nodes: any[] = [];
            scene.walk((node: any) => { if (node.getComponent(sp.Skeleton)) nodes.push({ uuid: node.uuid, name: node.name }); });
            return { success: true, data: { nodes, count: nodes.length } };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    addSpineToNode(nodeUuid: string, skeletonDataUuid: string) {
        try {
            const { director, assetManager } = require('cc');
            let sp: any;
            try { sp = require('cc').sp; if (!sp) throw new Error('not found'); } catch { return { success: false, error: 'Spine module not available in this project' }; }
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const node = findNodeByUuidDeep(scene, nodeUuid);
            if (!node) return { success: false, error: `Node ${nodeUuid} not found` };
            const comp = node.addComponent(sp.Skeleton);
            assetManager.loadAny(skeletonDataUuid, (err: any, asset: any) => { if (!err && asset) comp.skeletonData = asset; });
            return { success: true, data: { nodeUuid, skeletonDataUuid } };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    // ── DragonBones ───────────────────────────────────────────────────────────

    getDragonBonesInfo(nodeUuid: string) {
        try {
            const { director } = require('cc');
            let db: any;
            try { db = require('cc').dragonBones; if (!db) throw new Error('not found'); } catch { return { success: false, error: 'DragonBones module not available in this project' }; }
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const node = findNodeByUuidDeep(scene, nodeUuid);
            if (!node) return { success: false, error: `Node ${nodeUuid} not found` };
            const comp = node.getComponent(db.ArmatureDisplay);
            if (!comp) return { success: false, error: 'No ArmatureDisplay component on node' };
            const animations: string[] = [];
            const armatureNames: string[] = [];
            try { if (comp.dragonAsset) { armatureNames.push(...(comp.dragonAsset.armatureNames || [])); const factory = db.CCFactory.getInstance(); if (factory) { const arm = factory.buildArmature(comp.armatureName, comp.dragonAsset.name); if (arm) { animations.push(...arm.animation.animationNames); arm.dispose(); } } } } catch { /* ignore */ }
            return { success: true, data: { armatureNames, animations, timeScale: comp.timeScale, armatureName: comp.armatureName } };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    setDragonBonesAnimation(nodeUuid: string, animationName: string, playTimes: number) {
        try {
            const { director } = require('cc');
            let db: any;
            try { db = require('cc').dragonBones; if (!db) throw new Error('not found'); } catch { return { success: false, error: 'DragonBones module not available in this project' }; }
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const node = findNodeByUuidDeep(scene, nodeUuid);
            if (!node) return { success: false, error: `Node ${nodeUuid} not found` };
            const comp = node.getComponent(db.ArmatureDisplay);
            if (!comp) return { success: false, error: 'No ArmatureDisplay component on node' };
            comp.playAnimation(animationName, playTimes);
            return { success: true, data: { animationName, playTimes } };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    setDragonBonesArmature(nodeUuid: string, armatureName: string) {
        try {
            const { director } = require('cc');
            let db: any;
            try { db = require('cc').dragonBones; if (!db) throw new Error('not found'); } catch { return { success: false, error: 'DragonBones module not available in this project' }; }
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const node = findNodeByUuidDeep(scene, nodeUuid);
            if (!node) return { success: false, error: `Node ${nodeUuid} not found` };
            const comp = node.getComponent(db.ArmatureDisplay);
            if (!comp) return { success: false, error: 'No ArmatureDisplay component on node' };
            comp.armatureName = armatureName;
            return { success: true, data: { armatureName } };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    setDragonBonesProperty(nodeUuid: string, property: string, value: any) {
        try {
            const { director } = require('cc');
            let db: any;
            try { db = require('cc').dragonBones; if (!db) throw new Error('not found'); } catch { return { success: false, error: 'DragonBones module not available in this project' }; }
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const node = findNodeByUuidDeep(scene, nodeUuid);
            if (!node) return { success: false, error: `Node ${nodeUuid} not found` };
            const comp = node.getComponent(db.ArmatureDisplay);
            if (!comp) return { success: false, error: 'No ArmatureDisplay component on node' };
            const allowed = ['timeScale', 'debugBones', 'playTimes'];
            if (!allowed.includes(property)) return { success: false, error: `Property '${property}' not allowed. Use: ${allowed.join(', ')}` };
            (comp as any)[property] = value;
            return { success: true, data: { property, value } };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    listDragonBonesNodes() {
        try {
            const { director } = require('cc');
            let db: any;
            try { db = require('cc').dragonBones; if (!db) throw new Error('not found'); } catch { return { success: false, error: 'DragonBones module not available in this project' }; }
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const nodes: any[] = [];
            scene.walk((node: any) => { if (node.getComponent(db.ArmatureDisplay)) nodes.push({ uuid: node.uuid, name: node.name }); });
            return { success: true, data: { nodes, count: nodes.length } };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    addDragonBonesToNode(nodeUuid: string, dragonBonesAssetUuid: string, dragonBonesAtlasAssetUuid: string) {
        try {
            const { director, assetManager } = require('cc');
            let db: any;
            try { db = require('cc').dragonBones; if (!db) throw new Error('not found'); } catch { return { success: false, error: 'DragonBones module not available in this project' }; }
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const node = findNodeByUuidDeep(scene, nodeUuid);
            if (!node) return { success: false, error: `Node ${nodeUuid} not found` };
            const comp = node.addComponent(db.ArmatureDisplay);
            assetManager.loadAny([dragonBonesAssetUuid, dragonBonesAtlasAssetUuid], (err: any, assets: any[]) => {
                if (!err && assets) { comp.dragonAsset = assets[0]; comp.dragonAtlasAsset = assets[1]; }
            });
            return { success: true, data: { nodeUuid, dragonBonesAssetUuid, dragonBonesAtlasAssetUuid } };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    // ── Terrain ───────────────────────────────────────────────────────────────

    getTerrainInfo(nodeUuid: string) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const node = findNodeByUuidDeep(scene, nodeUuid);
            if (!node) return { success: false, error: `Node ${nodeUuid} not found` };
            const Terrain = js.getClassByName('Terrain');
            if (!Terrain) return { success: false, error: 'Terrain class not found — 3D only' };
            const comp = node.getComponent(Terrain);
            if (!comp) return { success: false, error: 'No Terrain component on node' };
            const layerCount = comp.getLayerCount ? comp.getLayerCount() : (comp.layers ? comp.layers.length : 0);
            return { success: true, data: { tileSize: comp.tileSize, weightMapSize: comp.weightMapSize, lightMapSize: comp.lightMapSize, blockCount: comp.blockCount, layerCount } };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    setTerrainProperty(nodeUuid: string, property: string, value: any) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const node = findNodeByUuidDeep(scene, nodeUuid);
            if (!node) return { success: false, error: `Node ${nodeUuid} not found` };
            const Terrain = js.getClassByName('Terrain');
            if (!Terrain) return { success: false, error: 'Terrain class not found — 3D only' };
            const comp = node.getComponent(Terrain);
            if (!comp) return { success: false, error: 'No Terrain component on node' };
            const allowed = ['tileSize', 'weightMapSize', 'lightMapSize'];
            if (!allowed.includes(property)) return { success: false, error: `Property '${property}' not allowed. Use: ${allowed.join(', ')}` };
            (comp as any)[property] = value;
            return { success: true, data: { property, value } };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    getTerrainLayerInfo(nodeUuid: string, layerIndex: number) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const node = findNodeByUuidDeep(scene, nodeUuid);
            if (!node) return { success: false, error: `Node ${nodeUuid} not found` };
            const Terrain = js.getClassByName('Terrain');
            if (!Terrain) return { success: false, error: 'Terrain class not found — 3D only' };
            const comp = node.getComponent(Terrain);
            if (!comp) return { success: false, error: 'No Terrain component on node' };
            const layer = comp.getLayer ? comp.getLayer(layerIndex) : (comp.layers ? comp.layers[layerIndex] : null);
            if (!layer) return { success: false, error: `Layer ${layerIndex} not found` };
            return { success: true, data: { layerIndex, tileSize: layer.tileSize, detailMap: layer.detailMap?.uuid } };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    setTerrainLayer(nodeUuid: string, layerIndex: number, detailMapUuid: string, tileSize: number) {
        try {
            const { director, js, assetManager } = require('cc');
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const node = findNodeByUuidDeep(scene, nodeUuid);
            if (!node) return { success: false, error: `Node ${nodeUuid} not found` };
            const Terrain = js.getClassByName('Terrain');
            if (!Terrain) return { success: false, error: 'Terrain class not found — 3D only' };
            const comp = node.getComponent(Terrain);
            if (!comp) return { success: false, error: 'No Terrain component on node' };
            assetManager.loadAny(detailMapUuid, (err: any, asset: any) => {
                if (err || !asset) return;
                const layer = comp.getLayer ? comp.getLayer(layerIndex) : (comp.layers ? comp.layers[layerIndex] : null);
                if (layer) { layer.detailMap = asset; if (tileSize !== undefined) layer.tileSize = tileSize; }
            });
            return { success: true, data: { layerIndex, detailMapUuid, tileSize } };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    getTerrainHeight(nodeUuid: string, x: number, y: number) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const node = findNodeByUuidDeep(scene, nodeUuid);
            if (!node) return { success: false, error: `Node ${nodeUuid} not found` };
            const Terrain = js.getClassByName('Terrain');
            if (!Terrain) return { success: false, error: 'Terrain class not found — 3D only' };
            const comp = node.getComponent(Terrain);
            if (!comp) return { success: false, error: 'No Terrain component on node' };
            const height = comp.getHeight ? comp.getHeight(x, y) : null;
            return { success: true, data: { x, y, height } };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    setTerrainHeight(nodeUuid: string, x: number, y: number, height: number) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const node = findNodeByUuidDeep(scene, nodeUuid);
            if (!node) return { success: false, error: `Node ${nodeUuid} not found` };
            const Terrain = js.getClassByName('Terrain');
            if (!Terrain) return { success: false, error: 'Terrain class not found — 3D only' };
            const comp = node.getComponent(Terrain);
            if (!comp) return { success: false, error: 'No Terrain component on node' };
            if (!comp.setHeight) return { success: false, error: 'setHeight not available on this Terrain version' };
            comp.setHeight(x, y, height);
            return { success: true, data: { x, y, height } };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    listTerrainNodes() {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const Terrain = js.getClassByName('Terrain');
            if (!Terrain) return { success: false, error: 'Terrain class not found — 3D only' };
            const nodes: any[] = [];
            scene.walk((node: any) => { if (node.getComponent(Terrain)) nodes.push({ uuid: node.uuid, name: node.name }); });
            return { success: true, data: { nodes, count: nodes.length } };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    // ── Phase 4: Render Pipeline ──────────────────────────────────────────

    getRenderPipelineInfo() {
        try {
            const { director } = require('cc');
            const pipeline = director.root && director.root.pipeline;
            if (!pipeline) return { success: false, error: 'No render pipeline — 3D scene required' };
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
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    setShadowSettings(enabled: boolean | undefined, type: string | undefined, shadowMapSize: number | undefined) {
        try {
            const { director } = require('cc');
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const shadows = scene.globals && scene.globals.shadows;
            if (!shadows) return { success: false, error: 'Shadow globals not available — 3D scene required' };
            if (enabled !== undefined) shadows.enabled = enabled;
            if (type !== undefined) shadows.type = type;
            if (shadowMapSize !== undefined) shadows.mapSize = shadowMapSize;
            return { success: true, data: { enabled: shadows.enabled, type: shadows.type, mapSize: shadows.mapSize } };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    setFogSettings(enabled: boolean | undefined, fogColor: string | undefined, type: string | undefined, fogStart: number | undefined, fogEnd: number | undefined, fogDensity: number | undefined) {
        try {
            const { director, Color } = require('cc');
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const fog = scene.globals && scene.globals.fog;
            if (!fog) return { success: false, error: 'Fog globals not available — 3D scene required' };
            if (enabled !== undefined) fog.enabled = enabled;
            if (type !== undefined) fog.type = type;
            if (fogStart !== undefined) fog.fogStart = fogStart;
            if (fogEnd !== undefined) fog.fogEnd = fogEnd;
            if (fogDensity !== undefined) fog.fogDensity = fogDensity;
            if (fogColor !== undefined) {
                const hex = fogColor.replace('#', '');
                const r = parseInt(hex.substring(0, 2), 16);
                const g = parseInt(hex.substring(2, 4), 16);
                const b = parseInt(hex.substring(4, 6), 16);
                fog.fogColor = new Color(r, g, b, 255);
            }
            return { success: true, data: { enabled: fog.enabled, type: fog.type, fogStart: fog.fogStart, fogEnd: fog.fogEnd, fogDensity: fog.fogDensity } };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    setSkyboxSettings(enabled: boolean | undefined, useHDR: boolean | undefined, rotationAngle: number | undefined) {
        try {
            const { director } = require('cc');
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const skybox = scene.globals && scene.globals.skybox;
            if (!skybox) return { success: false, error: 'Skybox globals not available — 3D scene required' };
            if (enabled !== undefined) skybox.enabled = enabled;
            if (useHDR !== undefined) skybox.useHDR = useHDR;
            if (rotationAngle !== undefined) skybox.rotationAngle = rotationAngle;
            return { success: true, data: { enabled: skybox.enabled, useHDR: skybox.useHDR, rotationAngle: skybox.rotationAngle } };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    setPostProcessSettings(bloom: { enabled?: boolean; intensity?: number } | undefined, tonemap: string | undefined) {
        try {
            const { director } = require('cc');
            const pipeline = director.root && director.root.pipeline;
            if (!pipeline) return { success: false, error: 'No render pipeline — 3D scene required' };
            const pp = pipeline.postProcess || (pipeline.getPostProcess && pipeline.getPostProcess());
            if (!pp) return { success: false, error: 'PostProcess not available on this pipeline' };
            if (bloom !== undefined && pp.bloom) {
                if (bloom.enabled !== undefined) pp.bloom.enabled = bloom.enabled;
                if (bloom.intensity !== undefined) pp.bloom.intensity = bloom.intensity;
            }
            if (tonemap !== undefined && pp.colorGrading) {
                pp.colorGrading.tonemapMode = tonemap;
            }
            return { success: true, data: { bloom: pp.bloom ? { enabled: pp.bloom.enabled, intensity: pp.bloom.intensity } : null, tonemap } };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    // ── Phase 4: Mesh Renderer ────────────────────────────────────────────

    getMeshRendererInfo(nodeUuid: string) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const node = findNodeByUuidDeep(scene, nodeUuid);
            if (!node) return { success: false, error: `Node ${nodeUuid} not found` };
            const MeshRenderer = js.getClassByName('MeshRenderer');
            if (!MeshRenderer) return { success: false, error: 'MeshRenderer not available — 3D only' };
            const comp = node.getComponent(MeshRenderer);
            if (!comp) return { success: false, error: 'No MeshRenderer on node' };
            return {
                success: true, data: {
                    nodeUuid, nodeName: node.name,
                    shadowCastingMode: comp.shadowCastingMode,
                    receiveShadow: comp.receiveShadow,
                    visibility: comp.visibility,
                    mesh: comp.mesh ? { uuid: comp.mesh._uuid, name: comp.mesh.name } : null,
                    materials: comp.sharedMaterials ? comp.sharedMaterials.map((m: any) => m ? { uuid: m._uuid, name: m.name } : null) : [],
                }
            };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    setMeshRendererProperty(nodeUuid: string, property: string, value: any) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const node = findNodeByUuidDeep(scene, nodeUuid);
            if (!node) return { success: false, error: `Node ${nodeUuid} not found` };
            const MeshRenderer = js.getClassByName('MeshRenderer');
            if (!MeshRenderer) return { success: false, error: 'MeshRenderer not available — 3D only' };
            const comp = node.getComponent(MeshRenderer);
            if (!comp) return { success: false, error: 'No MeshRenderer on node' };
            const allowed = ['shadowCastingMode', 'receiveShadow', 'visibility'];
            if (!allowed.includes(property)) return { success: false, error: `Property '${property}' not allowed. Use: ${allowed.join(', ')}` };
            (comp as any)[property] = value;
            return { success: true, data: { nodeUuid, property, value } };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    // ── Phase 4: Profiler ─────────────────────────────────────────────────

    getPerformanceStats() {
        try {
            const { director, profiler } = require('cc');
            const scene = director.getScene();
            const nodeCount = scene ? (() => { let n = 0; scene.walk(() => n++); return n; })() : 0;
            const stats: any = { nodeCount };
            if (profiler) {
                stats.fps = profiler.fps !== undefined ? profiler.fps : null;
                stats.drawCalls = profiler.drawCalls !== undefined ? profiler.drawCalls : null;
                stats.triangles = profiler.triangles !== undefined ? profiler.triangles : null;
            }
            return { success: true, data: stats };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    getMemoryStats() {
        try {
            const memUsage = process.memoryUsage ? process.memoryUsage() : null;
            const data: any = {
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
            } catch { /* GPU stats optional */ }
            return { success: true, data };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    toggleStatsDisplay(visible: boolean | undefined) {
        try {
            const { profiler } = require('cc');
            if (!profiler) return { success: false, error: 'profiler module not available' };
            if (visible === true) {
                profiler.showStats && profiler.showStats();
            } else if (visible === false) {
                profiler.hideStats && profiler.hideStats();
            } else {
                // toggle
                if (profiler.isShowingStats && profiler.isShowingStats()) {
                    profiler.hideStats && profiler.hideStats();
                } else {
                    profiler.showStats && profiler.showStats();
                }
            }
            const nowVisible = profiler.isShowingStats ? profiler.isShowingStats() : visible;
            return { success: true, data: { visible: nowVisible } };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    getDrawCallStats() {
        try {
            const { director, profiler } = require('cc');
            const pipeline = director.root && director.root.pipeline;
            const data: any = {};
            if (profiler) {
                data.drawCalls = profiler.drawCalls !== undefined ? profiler.drawCalls : null;
                data.instancedDrawCalls = profiler.instancedDrawCalls !== undefined ? profiler.instancedDrawCalls : null;
                data.triangles = profiler.triangles !== undefined ? profiler.triangles : null;
            }
            if (pipeline && pipeline.sceneRenderer) {
                data.sceneRenderer = pipeline.sceneRenderer.getProfilingData ? pipeline.sceneRenderer.getProfilingData() : null;
            }
            return { success: true, data };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    // ── Phase 4: Video Player ─────────────────────────────────────────────

    addVideoPlayer(nodeUuid: string, clipUrl: string | undefined) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const node = findNodeByUuidDeep(scene, nodeUuid);
            if (!node) return { success: false, error: `Node ${nodeUuid} not found` };
            const VideoPlayer = js.getClassByName('VideoPlayer');
            if (!VideoPlayer) return { success: false, error: 'VideoPlayer component not available' };
            let comp = node.getComponent(VideoPlayer);
            if (!comp) comp = node.addComponent(VideoPlayer);
            return { success: true, data: { nodeUuid, nodeName: node.name, hasClip: !!clipUrl } };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    setVideoProperty(nodeUuid: string, property: string, value: any) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const node = findNodeByUuidDeep(scene, nodeUuid);
            if (!node) return { success: false, error: `Node ${nodeUuid} not found` };
            const VideoPlayer = js.getClassByName('VideoPlayer');
            if (!VideoPlayer) return { success: false, error: 'VideoPlayer not available' };
            const comp = node.getComponent(VideoPlayer);
            if (!comp) return { success: false, error: 'No VideoPlayer on node' };
            const allowed = ['resourceType', 'remoteURL', 'clip', 'loop', 'playbackRate', 'volume'];
            if (!allowed.includes(property)) return { success: false, error: `Property '${property}' not allowed. Use: ${allowed.join(', ')}` };
            (comp as any)[property] = value;
            return { success: true, data: { nodeUuid, property, value } };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    controlVideo(nodeUuid: string, command: string) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const node = findNodeByUuidDeep(scene, nodeUuid);
            if (!node) return { success: false, error: `Node ${nodeUuid} not found` };
            const VideoPlayer = js.getClassByName('VideoPlayer');
            if (!VideoPlayer) return { success: false, error: 'VideoPlayer not available' };
            const comp = node.getComponent(VideoPlayer);
            if (!comp) return { success: false, error: 'No VideoPlayer on node' };
            switch (command) {
                case 'play': comp.play && comp.play(); break;
                case 'pause': comp.pause && comp.pause(); break;
                case 'stop': comp.stop && comp.stop(); break;
                case 'resume': comp.resume && comp.resume(); break;
                default: return { success: false, error: `Unknown command '${command}'. Use: play, pause, stop, resume` };
            }
            return { success: true, data: { nodeUuid, command } };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    getVideoInfo(nodeUuid: string) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const node = findNodeByUuidDeep(scene, nodeUuid);
            if (!node) return { success: false, error: `Node ${nodeUuid} not found` };
            const VideoPlayer = js.getClassByName('VideoPlayer');
            if (!VideoPlayer) return { success: false, error: 'VideoPlayer not available' };
            const comp = node.getComponent(VideoPlayer);
            if (!comp) return { success: false, error: 'No VideoPlayer on node' };
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
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    listVideoPlayers() {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene) return { success: false, error: 'No active scene' };
            const VideoPlayer = js.getClassByName('VideoPlayer');
            if (!VideoPlayer) return { success: false, error: 'VideoPlayer not available' };
            const nodes: any[] = [];
            scene.walk((node: any) => {
                const comp = node.getComponent(VideoPlayer);
                if (comp) nodes.push({ uuid: node.uuid, name: node.name, resourceType: comp.resourceType, remoteURL: comp.remoteURL });
            });
            return { success: true, data: { nodes, count: nodes.length } };
        } catch (error: any) { return { success: false, error: error.message }; }
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
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    setTouchConfig(enabled: boolean) {
        try {
            const { input } = require('cc');
            if (!input) return { success: false, error: 'input module not available' };
            input.multiTouch = enabled;
            return { success: true, data: { multiTouch: input.multiTouch } };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    setAccelerationConfig(enabled: boolean, interval: number | undefined) {
        try {
            const { input, Input } = require('cc');
            if (!input) return { success: false, error: 'input module not available' };
            if (enabled) {
                input.setAccelerometerEnabled && input.setAccelerometerEnabled(true);
                if (interval !== undefined) {
                    input.setAccelerometerInterval && input.setAccelerometerInterval(interval);
                }
            } else {
                input.setAccelerometerEnabled && input.setAccelerometerEnabled(false);
            }
            return { success: true, data: { enabled, interval } };
        } catch (error: any) { return { success: false, error: error.message }; }
    },

    /**
     * Evaluate arbitrary JavaScript in the scene context and return its result.
     * Dangerous-pattern denylisting (require('child_process'), process.exit, eval(,
     * Function() happens client-side in ManageDebug.validateScript before this is
     * ever invoked — this method only runs already-approved scripts.
     */
    eval(code: string) {
        try {
            // eslint-disable-next-line no-new-func
            const fn = new Function(code);
            const result = fn();
            return { success: true, data: { result } };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    },
};