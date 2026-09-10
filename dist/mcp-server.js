"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCPServer = void 0;
const http = __importStar(require("http"));
const url = __importStar(require("url"));
const manage_scene_1 = require("./tools/manage-scene");
const manage_node_1 = require("./tools/manage-node");
const manage_component_1 = require("./tools/manage-component");
const manage_prefab_1 = require("./tools/manage-prefab");
const manage_asset_1 = require("./tools/manage-asset");
const manage_project_1 = require("./tools/manage-project");
const manage_debug_1 = require("./tools/manage-debug");
const manage_preferences_1 = require("./tools/manage-preferences");
const manage_server_1 = require("./tools/manage-server");
const manage_broadcast_1 = require("./tools/manage-broadcast");
const manage_scene_view_1 = require("./tools/manage-scene-view");
const manage_node_hierarchy_1 = require("./tools/manage-node-hierarchy");
const manage_scene_query_1 = require("./tools/manage-scene-query");
const manage_undo_1 = require("./tools/manage-undo");
const manage_reference_image_1 = require("./tools/manage-reference-image");
const manage_validation_1 = require("./tools/manage-validation");
const manage_selection_1 = require("./tools/manage-selection");
const manage_script_1 = require("./tools/manage-script");
const manage_material_1 = require("./tools/manage-material");
const manage_animation_1 = require("./tools/manage-animation");
// Phase 1: Core Tools
const manage_light_1 = require("./tools/manage-light");
const manage_camera_1 = require("./tools/manage-camera");
const manage_physics_1 = require("./tools/manage-physics");
const manage_ui_1 = require("./tools/manage-ui");
const batch_execute_1 = require("./tools/batch-execute");
// Phase 2: Game Tools
const manage_audio_1 = require("./tools/manage-audio");
const manage_particle_1 = require("./tools/manage-particle");
const manage_tween_1 = require("./tools/manage-tween");
const manage_editor_1 = require("./tools/manage-editor");
// Phase 3: Specialized Tools
const manage_tilemap_1 = require("./tools/manage-tilemap");
const manage_spine_1 = require("./tools/manage-spine");
const manage_dragonbones_1 = require("./tools/manage-dragonbones");
const execute_menu_item_1 = require("./tools/execute-menu-item");
const manage_terrain_1 = require("./tools/manage-terrain");
// Phase 4: Polish Tools
const manage_render_pipeline_1 = require("./tools/manage-render-pipeline");
const manage_shader_effect_1 = require("./tools/manage-shader-effect");
const manage_mesh_1 = require("./tools/manage-mesh");
const manage_profiler_1 = require("./tools/manage-profiler");
const manage_video_1 = require("./tools/manage-video");
const manage_input_1 = require("./tools/manage-input");
const cocos_resources_1 = require("./resources/cocos-resources");
const mutation_queue_1 = require("./tools/mutation-queue");
const MAX_BODY_SIZE = 1024 * 1024; // 1MB request body limit
class MCPServer {
    constructor(settings) {
        this.httpServer = null;
        this.toolExecutors = new Map();
        this.toolDefinitions = [];
        this.toolsList = [];
        this.enabledTools = [];
        this.resourceProvider = new cocos_resources_1.CocosResources();
        this.settings = settings;
        this.initializeTools();
    }
    initializeTools() {
        try {
            console.log('[MCPServer] Initializing v2 action-based tools...');
            const tools = [
                new manage_scene_1.ManageScene(),
                new manage_node_1.ManageNode(),
                new manage_component_1.ManageComponent(),
                new manage_prefab_1.ManagePrefab(),
                new manage_asset_1.ManageAsset(),
                new manage_project_1.ManageProject(),
                new manage_debug_1.ManageDebug(),
                new manage_preferences_1.ManagePreferences(),
                new manage_server_1.ManageServer(),
                new manage_broadcast_1.ManageBroadcast(),
                new manage_scene_view_1.ManageSceneView(),
                new manage_node_hierarchy_1.ManageNodeHierarchy(),
                new manage_scene_query_1.ManageSceneQuery(),
                new manage_undo_1.ManageUndo(),
                new manage_reference_image_1.ManageReferenceImage(),
                new manage_validation_1.ManageValidation(),
                new manage_selection_1.ManageSelection(),
                new manage_script_1.ManageScript(),
                new manage_material_1.ManageMaterial(),
                new manage_animation_1.ManageAnimation(),
                // Phase 1: Core Tools
                new manage_light_1.ManageLight(),
                new manage_camera_1.ManageCamera(),
                new manage_physics_1.ManagePhysics(),
                new manage_ui_1.ManageUI(),
                new batch_execute_1.BatchExecute({ executeToolCall: this.executeToolCall.bind(this) }),
                // Phase 2: Game Tools
                new manage_audio_1.ManageAudio(),
                new manage_particle_1.ManageParticle(),
                new manage_tween_1.ManageTween(),
                new manage_editor_1.ManageEditor(),
                // Phase 3: Specialized Tools
                new manage_tilemap_1.ManageTilemap(),
                new manage_spine_1.ManageSpine(),
                new manage_dragonbones_1.ManageDragonBones(),
                new execute_menu_item_1.ExecuteMenuItem(),
                new manage_terrain_1.ManageTerrain(),
                // Phase 4: Polish Tools
                new manage_render_pipeline_1.ManageRenderPipeline(),
                new manage_shader_effect_1.ManageShaderEffect(),
                new manage_mesh_1.ManageMesh(),
                new manage_profiler_1.ManageProfiler(),
                new manage_video_1.ManageVideo(),
                new manage_input_1.ManageInput(),
            ];
            for (const tool of tools) {
                this.toolExecutors.set(tool.name, tool);
                this.toolDefinitions.push({
                    name: tool.name,
                    description: tool.description,
                    inputSchema: tool.inputSchema
                });
            }
            console.log(`[MCPServer] ${this.toolDefinitions.length} v2 tools initialized`);
        }
        catch (error) {
            console.error('[MCPServer] Error initializing tools:', error);
            throw error;
        }
    }
    async start() {
        if (this.httpServer) {
            console.log('[MCPServer] Server is already running');
            return;
        }
        try {
            console.log(`[MCPServer] Starting HTTP server on port ${this.settings.port}...`);
            this.httpServer = http.createServer(this.handleHttpRequest.bind(this));
            await new Promise((resolve, reject) => {
                this.httpServer.listen(this.settings.port, '127.0.0.1', () => {
                    console.log(`[MCPServer] ✅ HTTP server started successfully on http://127.0.0.1:${this.settings.port}`);
                    console.log(`[MCPServer] Health check: http://127.0.0.1:${this.settings.port}/health`);
                    console.log(`[MCPServer] MCP endpoint: http://127.0.0.1:${this.settings.port}/mcp`);
                    resolve();
                });
                this.httpServer.on('error', (err) => {
                    console.error('[MCPServer] ❌ Failed to start server:', err);
                    if (err.code === 'EADDRINUSE') {
                        console.error(`[MCPServer] Port ${this.settings.port} is already in use. Please change the port in settings.`);
                    }
                    reject(err);
                });
            });
            this.setupTools();
            console.log('[MCPServer] 🚀 MCP Server is ready for connections');
        }
        catch (error) {
            console.error('[MCPServer] ❌ Failed to start server:', error);
            throw error;
        }
    }
    setupTools() {
        this.toolsList = [];
        if (!this.enabledTools || this.enabledTools.length === 0) {
            // No filter — return all tools
            this.toolsList = [...this.toolDefinitions];
        }
        else {
            // Filter by enabled tool names
            const enabledSet = new Set(this.enabledTools);
            this.toolsList = this.toolDefinitions.filter(t => enabledSet.has(t.name));
        }
        console.log(`[MCPServer] Setup tools: ${this.toolsList.length} tools available`);
    }
    getFilteredTools(enabledTools) {
        if (!enabledTools || enabledTools.length === 0) {
            return this.toolsList;
        }
        const enabledSet = new Set(enabledTools);
        return this.toolsList.filter(tool => enabledSet.has(tool.name));
    }
    async executeToolCall(toolName, args) {
        const executor = this.toolExecutors.get(toolName);
        if (!executor) {
            throw new Error(`Tool '${toolName}' not found. Available: ${Array.from(this.toolExecutors.keys()).join(', ')}`);
        }
        const { action } = args, restArgs = __rest(args, ["action"]);
        if (!action) {
            throw new Error(`Missing required 'action' parameter for tool '${toolName}'. ` +
                `Available actions: ${executor.actions.join(', ')}`);
        }
        // #6: tool calls issued concurrently by a client interleave inside the editor, so a
        // save can run while a `manage_node create` is still committing and silently drop it.
        // Serializing every call on one chain here — the single dispatch point every tool
        // call passes through — is what prevents that race; verifying the save afterwards
        // only detects it. Re-entrant tools run directly: batch_execute calls back into this
        // method per entry, so enqueueing it would deadlock it behind its own slot, and its
        // inner calls are each serialized on their own anyway.
        if (executor.reentrant) {
            return await executor.execute(action, restArgs);
        }
        return await (0, mutation_queue_1.enqueueMutation)(() => executor.execute(action, restArgs));
    }
    getAvailableTools() {
        return this.toolsList;
    }
    updateEnabledTools(enabledTools) {
        console.log(`[MCPServer] Updating enabled tools: ${enabledTools.length} tools`);
        this.enabledTools = enabledTools;
        this.setupTools();
    }
    getSettings() {
        return this.settings;
    }
    async handleHttpRequest(req, res) {
        const parsedUrl = url.parse(req.url || '', true);
        const pathname = parsedUrl.pathname;
        // Set CORS headers — enforce allowedOrigins if configured
        const origin = req.headers.origin;
        const allowedOrigins = this.settings.allowedOrigins;
        if (!allowedOrigins || allowedOrigins.length === 0 || allowedOrigins.includes('*')) {
            res.setHeader('Access-Control-Allow-Origin', '*');
        }
        else if (origin && allowedOrigins.includes(origin)) {
            res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Vary', 'Origin');
        }
        else if (origin && allowedOrigins.length > 0) {
            // Origin not in allowedOrigins — reject with 403
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Origin not allowed' }));
            return;
        }
        // No origin header (non-browser clients like curl, MCP clients) — allow through
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.setHeader('Content-Type', 'application/json');
        if (req.method === 'OPTIONS') {
            if (!res.writableEnded) {
                res.writeHead(200);
                res.end();
            }
            return;
        }
        try {
            if (pathname === '/mcp' && req.method === 'POST') {
                await this.handleMCPRequest(req, res);
            }
            else if (pathname === '/health' && req.method === 'GET') {
                if (!res.writableEnded) {
                    res.writeHead(200);
                    res.end(JSON.stringify({ status: 'ok', tools: this.toolsList.length }));
                }
            }
            else if ((pathname === null || pathname === void 0 ? void 0 : pathname.startsWith('/api/')) && req.method === 'POST') {
                await this.handleSimpleAPIRequest(req, res, pathname);
            }
            else if (pathname === '/api/tools' && req.method === 'GET') {
                if (!res.writableEnded) {
                    res.writeHead(200);
                    res.end(JSON.stringify({ tools: this.getSimplifiedToolsList() }));
                }
            }
            else {
                if (!res.writableEnded) {
                    res.writeHead(404);
                    res.end(JSON.stringify({ error: 'Not found' }));
                }
            }
        }
        catch (error) {
            console.error('HTTP request error:', error);
            if (!res.writableEnded) {
                res.writeHead(500);
                res.end(JSON.stringify({ error: 'Internal server error' }));
            }
        }
    }
    async handleMCPRequest(req, res) {
        let body = '';
        let bodySize = 0;
        req.on('data', (chunk) => {
            bodySize += chunk.length;
            if (bodySize > MAX_BODY_SIZE) {
                req.destroy();
                if (!res.writableEnded) {
                    res.writeHead(413);
                    res.end(JSON.stringify({ error: 'Request body too large' }));
                }
                return;
            }
            body += chunk.toString();
        });
        req.on('end', async () => {
            var _a;
            if (res.writableEnded)
                return;
            try {
                const message = JSON.parse(body);
                // JSON-RPC 2.0 validation
                if (!message.jsonrpc || message.jsonrpc !== '2.0') {
                    res.writeHead(200);
                    res.end(JSON.stringify({
                        jsonrpc: '2.0',
                        id: (_a = message.id) !== null && _a !== void 0 ? _a : null,
                        error: { code: -32600, message: 'Invalid Request: missing jsonrpc field' }
                    }));
                    return;
                }
                const response = await this.handleMessage(message);
                if (!res.writableEnded) {
                    res.writeHead(200);
                    res.end(JSON.stringify(response));
                }
            }
            catch (error) {
                console.error('Error handling MCP request:', error);
                if (!res.writableEnded) {
                    res.writeHead(400);
                    res.end(JSON.stringify({
                        jsonrpc: '2.0',
                        id: null,
                        error: { code: -32700, message: `Parse error: ${error.message}` }
                    }));
                }
            }
        });
    }
    async handleMessage(message) {
        const { id, method, params } = message;
        if (this.settings.enableDebugLog) {
            console.log(`[MCPServer] [debug] method=${method} id=${id}`);
        }
        try {
            let result;
            switch (method) {
                case 'tools/list':
                    result = { tools: this.getAvailableTools() };
                    break;
                case 'tools/call': {
                    const { name, arguments: callArgs } = params;
                    const toolResult = await this.executeToolCall(name, callArgs);
                    result = {
                        content: [{ type: 'text', text: JSON.stringify(toolResult) }],
                        isError: toolResult.isError || false
                    };
                    break;
                }
                case 'resources/list':
                    result = { resources: this.resourceProvider.resources };
                    break;
                case 'resources/read': {
                    const { uri } = params;
                    const content = await this.resourceProvider.read(uri);
                    result = { contents: [content] };
                    break;
                }
                case 'initialize':
                    result = {
                        protocolVersion: '2024-11-05',
                        capabilities: {
                            tools: {},
                            resources: {}
                        },
                        serverInfo: {
                            name: 'cocos-mcp-server',
                            version: '2.0.0'
                        }
                    };
                    break;
                default:
                    return {
                        jsonrpc: '2.0',
                        id,
                        error: { code: -32601, message: `Method not found: ${method}` }
                    };
            }
            return {
                jsonrpc: '2.0',
                id,
                result
            };
        }
        catch (error) {
            return {
                jsonrpc: '2.0',
                id,
                error: {
                    code: -32603,
                    message: error.message
                }
            };
        }
    }
    stop() {
        if (this.httpServer) {
            this.httpServer.close();
            this.httpServer = null;
            console.log('[MCPServer] HTTP server stopped');
        }
    }
    getStatus() {
        return {
            running: !!this.httpServer,
            port: this.settings.port,
            clients: 0 // HTTP is stateless, no persistent clients
        };
    }
    async handleSimpleAPIRequest(req, res, pathname) {
        let body = '';
        let bodySize = 0;
        req.on('data', (chunk) => {
            bodySize += chunk.length;
            if (bodySize > MAX_BODY_SIZE) {
                req.destroy();
                if (!res.writableEnded) {
                    res.writeHead(413);
                    res.end(JSON.stringify({ error: 'Request body too large' }));
                }
                return;
            }
            body += chunk.toString();
        });
        req.on('end', async () => {
            if (res.writableEnded)
                return;
            try {
                // Extract tool name from path like /api/manage_node
                const pathParts = pathname.split('/').filter(p => p);
                if (pathParts.length < 2) {
                    res.writeHead(400);
                    res.end(JSON.stringify({ error: 'Invalid API path. Use /api/{tool_name}' }));
                    return;
                }
                const fullToolName = pathParts.slice(1).join('_');
                let params;
                try {
                    params = body ? JSON.parse(body) : {};
                }
                catch (parseError) {
                    res.writeHead(400);
                    res.end(JSON.stringify({
                        error: 'Invalid JSON in request body',
                        details: parseError.message
                    }));
                    return;
                }
                const result = await this.executeToolCall(fullToolName, params);
                if (!res.writableEnded) {
                    res.writeHead(200);
                    res.end(JSON.stringify({ success: true, tool: fullToolName, result }));
                }
            }
            catch (error) {
                console.error('Simple API error:', error);
                if (!res.writableEnded) {
                    res.writeHead(500);
                    res.end(JSON.stringify({ success: false, error: error.message, tool: pathname }));
                }
            }
        });
    }
    getSimplifiedToolsList() {
        return this.toolsList.map(tool => {
            const executor = this.toolExecutors.get(tool.name);
            return {
                name: tool.name,
                description: tool.description,
                actions: executor ? executor.actions : [],
                apiPath: `/api/${tool.name}`,
                curlExample: this.generateCurlExample(tool.name, tool.inputSchema)
            };
        });
    }
    generateCurlExample(toolName, schema) {
        const sampleParams = this.generateSampleParams(schema);
        const jsonString = JSON.stringify(sampleParams, null, 2);
        return `curl -X POST http://127.0.0.1:${this.settings.port}/api/${toolName} \\
  -H "Content-Type: application/json" \\
  -d '${jsonString}'`;
    }
    generateSampleParams(schema) {
        if (!schema || !schema.properties)
            return {};
        const sample = {};
        for (const [key, prop] of Object.entries(schema.properties)) {
            const propSchema = prop;
            switch (propSchema.type) {
                case 'string':
                    sample[key] = propSchema.default || 'example_string';
                    break;
                case 'number':
                    sample[key] = propSchema.default || 42;
                    break;
                case 'boolean':
                    sample[key] = propSchema.default || true;
                    break;
                case 'object':
                    sample[key] = propSchema.default || { x: 0, y: 0, z: 0 };
                    break;
                default:
                    sample[key] = 'example_value';
            }
        }
        return sample;
    }
    updateSettings(settings) {
        this.settings = settings;
        if (this.httpServer) {
            this.stop();
            this.start().catch(err => console.error('[MCPServer] Failed to restart after settings update:', err));
        }
    }
}
exports.MCPServer = MCPServer;
// HTTP transport doesn't need persistent connections
// MCP over HTTP uses request-response pattern
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwLXNlcnZlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NvdXJjZS9tY3Atc2VydmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsMkNBQTZCO0FBQzdCLHlDQUEyQjtBQUUzQix1REFBbUQ7QUFDbkQscURBQWlEO0FBQ2pELCtEQUEyRDtBQUMzRCx5REFBcUQ7QUFDckQsdURBQW1EO0FBQ25ELDJEQUF1RDtBQUN2RCx1REFBbUQ7QUFDbkQsbUVBQStEO0FBQy9ELHlEQUFxRDtBQUNyRCwrREFBMkQ7QUFDM0QsaUVBQTREO0FBQzVELHlFQUFvRTtBQUNwRSxtRUFBOEQ7QUFDOUQscURBQWlEO0FBQ2pELDJFQUFzRTtBQUN0RSxpRUFBNkQ7QUFDN0QsK0RBQTJEO0FBQzNELHlEQUFxRDtBQUNyRCw2REFBeUQ7QUFDekQsK0RBQTJEO0FBQzNELHNCQUFzQjtBQUN0Qix1REFBbUQ7QUFDbkQseURBQXFEO0FBQ3JELDJEQUF1RDtBQUN2RCxpREFBNkM7QUFDN0MseURBQXFEO0FBQ3JELHNCQUFzQjtBQUN0Qix1REFBbUQ7QUFDbkQsNkRBQXlEO0FBQ3pELHVEQUFtRDtBQUNuRCx5REFBcUQ7QUFDckQsNkJBQTZCO0FBQzdCLDJEQUF1RDtBQUN2RCx1REFBbUQ7QUFDbkQsbUVBQStEO0FBQy9ELGlFQUE0RDtBQUM1RCwyREFBdUQ7QUFDdkQsd0JBQXdCO0FBQ3hCLDJFQUFzRTtBQUN0RSx1RUFBa0U7QUFDbEUscURBQWlEO0FBQ2pELDZEQUF5RDtBQUN6RCx1REFBbUQ7QUFDbkQsdURBQW1EO0FBQ25ELGlFQUE2RDtBQUM3RCwyREFBeUQ7QUFFekQsTUFBTSxhQUFhLEdBQUcsSUFBSSxHQUFHLElBQUksQ0FBQyxDQUFDLHlCQUF5QjtBQUU1RCxNQUFhLFNBQVM7SUFTbEIsWUFBWSxRQUEyQjtRQVAvQixlQUFVLEdBQXVCLElBQUksQ0FBQztRQUN0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LENBQUMsR0FBRyxVQUFVLENBQUMsT0FBTyxJQUFJLGdCQUFnQixDQUFDO29CQUNyRCxNQUFNO2dCQUNWLEtBQUssUUFBUTtvQkFDVCxNQUFNLENBQUMsR0FBRyxDQUFDLEdBQUcsVUFBVSxDQUFDLE9BQU8sSUFBSSxFQUFFLENBQUM7b0JBQ3ZDLE1BQU07Z0JBQ1YsS0FBSyxTQUFTO29CQUNWLE1BQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxVQUFVLENBQUMsT0FBTyxJQUFJLElBQUksQ0FBQztvQkFDekMsTUFBTTtnQkFDVixLQUFLLFFBQVE7b0JBQ1QsTUFBTSxDQUFDLEdBQUcsQ0FBQyxHQUFHLFVBQVUsQ0FBQyxPQUFPLElBQUksRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDO29CQUN6RCxNQUFNO2dCQUNWO29CQUNJLE1BQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxlQUFlLENBQUM7WUFDdEMsQ0FBQztRQUNMLENBQUM7UUFDRCxPQUFPLE1BQU0sQ0FBQztJQUNsQixDQUFDO0lBRU0sY0FBYyxDQUFDLFFBQTJCO1FBQzdDLElBQUksQ0FBQyxRQUFRLEdBQUcsUUFBUSxDQUFDO1FBQ3pCLElBQUksSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO1lBQ2xCLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUNaLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLHNEQUFzRCxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDMUcsQ0FBQztJQUNMLENBQUM7Q0FDSjtBQWxlRCw4QkFrZUM7QUFFRCxxREFBcUQ7QUFDckQsOENBQThDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgaHR0cCBmcm9tICdodHRwJztcbmltcG9ydCAqIGFzIHVybCBmcm9tICd1cmwnO1xuaW1wb3J0IHsgTUNQU2VydmVyU2V0dGluZ3MsIFNlcnZlclN0YXR1cywgVG9vbERlZmluaXRpb24sIEFjdGlvblRvb2xFeGVjdXRvciB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgTWFuYWdlU2NlbmUgfSBmcm9tICcuL3Rvb2xzL21hbmFnZS1zY2VuZSc7XG5pbXBvcnQgeyBNYW5hZ2VOb2RlIH0gZnJvbSAnLi90b29scy9tYW5hZ2Utbm9kZSc7XG5pbXBvcnQgeyBNYW5hZ2VDb21wb25lbnQgfSBmcm9tICcuL3Rvb2xzL21hbmFnZS1jb21wb25lbnQnO1xuaW1wb3J0IHsgTWFuYWdlUHJlZmFiIH0gZnJvbSAnLi90b29scy9tYW5hZ2UtcHJlZmFiJztcbmltcG9ydCB7IE1hbmFnZUFzc2V0IH0gZnJvbSAnLi90b29scy9tYW5hZ2UtYXNzZXQnO1xuaW1wb3J0IHsgTWFuYWdlUHJvamVjdCB9IGZyb20gJy4vdG9vbHMvbWFuYWdlLXByb2plY3QnO1xuaW1wb3J0IHsgTWFuYWdlRGVidWcgfSBmcm9tICcuL3Rvb2xzL21hbmFnZS1kZWJ1Zyc7XG5pbXBvcnQgeyBNYW5hZ2VQcmVmZXJlbmNlcyB9IGZyb20gJy4vdG9vbHMvbWFuYWdlLXByZWZlcmVuY2VzJztcbmltcG9ydCB7IE1hbmFnZVNlcnZlciB9IGZyb20gJy4vdG9vbHMvbWFuYWdlLXNlcnZlcic7XG5pbXBvcnQgeyBNYW5hZ2VCcm9hZGNhc3QgfSBmcm9tICcuL3Rvb2xzL21hbmFnZS1icm9hZGNhc3QnO1xuaW1wb3J0IHsgTWFuYWdlU2NlbmVWaWV3IH0gZnJvbSAnLi90b29scy9tYW5hZ2Utc2NlbmUtdmlldyc7XG5pbXBvcnQgeyBNYW5hZ2VOb2RlSGllcmFyY2h5IH0gZnJvbSAnLi90b29scy9tYW5hZ2Utbm9kZS1oaWVyYXJjaHknO1xuaW1wb3J0IHsgTWFuYWdlU2NlbmVRdWVyeSB9IGZyb20gJy4vdG9vbHMvbWFuYWdlLXNjZW5lLXF1ZXJ5JztcbmltcG9ydCB7IE1hbmFnZVVuZG8gfSBmcm9tICcuL3Rvb2xzL21hbmFnZS11bmRvJztcbmltcG9ydCB7IE1hbmFnZVJlZmVyZW5jZUltYWdlIH0gZnJvbSAnLi90b29scy9tYW5hZ2UtcmVmZXJlbmNlLWltYWdlJztcbmltcG9ydCB7IE1hbmFnZVZhbGlkYXRpb24gfSBmcm9tICcuL3Rvb2xzL21hbmFnZS12YWxpZGF0aW9uJztcbmltcG9ydCB7IE1hbmFnZVNlbGVjdGlvbiB9IGZyb20gJy4vdG9vbHMvbWFuYWdlLXNlbGVjdGlvbic7XG5pbXBvcnQgeyBNYW5hZ2VTY3JpcHQgfSBmcm9tICcuL3Rvb2xzL21hbmFnZS1zY3JpcHQnO1xuaW1wb3J0IHsgTWFuYWdlTWF0ZXJpYWwgfSBmcm9tICcuL3Rvb2xzL21hbmFnZS1tYXRlcmlhbCc7XG5pbXBvcnQgeyBNYW5hZ2VBbmltYXRpb24gfSBmcm9tICcuL3Rvb2xzL21hbmFnZS1hbmltYXRpb24nO1xuLy8gUGhhc2UgMTogQ29yZSBUb29sc1xuaW1wb3J0IHsgTWFuYWdlTGlnaHQgfSBmcm9tICcuL3Rvb2xzL21hbmFnZS1saWdodCc7XG5pbXBvcnQgeyBNYW5hZ2VDYW1lcmEgfSBmcm9tICcuL3Rvb2xzL21hbmFnZS1jYW1lcmEnO1xuaW1wb3J0IHsgTWFuYWdlUGh5c2ljcyB9IGZyb20gJy4vdG9vbHMvbWFuYWdlLXBoeXNpY3MnO1xuaW1wb3J0IHsgTWFuYWdlVUkgfSBmcm9tICcuL3Rvb2xzL21hbmFnZS11aSc7XG5pbXBvcnQgeyBCYXRjaEV4ZWN1dGUgfSBmcm9tICcuL3Rvb2xzL2JhdGNoLWV4ZWN1dGUnO1xuLy8gUGhhc2UgMjogR2FtZSBUb29sc1xuaW1wb3J0IHsgTWFuYWdlQXVkaW8gfSBmcm9tICcuL3Rvb2xzL21hbmFnZS1hdWRpbyc7XG5pbXBvcnQgeyBNYW5hZ2VQYXJ0aWNsZSB9IGZyb20gJy4vdG9vbHMvbWFuYWdlLXBhcnRpY2xlJztcbmltcG9ydCB7IE1hbmFnZVR3ZWVuIH0gZnJvbSAnLi90b29scy9tYW5hZ2UtdHdlZW4nO1xuaW1wb3J0IHsgTWFuYWdlRWRpdG9yIH0gZnJvbSAnLi90b29scy9tYW5hZ2UtZWRpdG9yJztcbi8vIFBoYXNlIDM6IFNwZWNpYWxpemVkIFRvb2xzXG5pbXBvcnQgeyBNYW5hZ2VUaWxlbWFwIH0gZnJvbSAnLi90b29scy9tYW5hZ2UtdGlsZW1hcCc7XG5pbXBvcnQgeyBNYW5hZ2VTcGluZSB9IGZyb20gJy4vdG9vbHMvbWFuYWdlLXNwaW5lJztcbmltcG9ydCB7IE1hbmFnZURyYWdvbkJvbmVzIH0gZnJvbSAnLi90b29scy9tYW5hZ2UtZHJhZ29uYm9uZXMnO1xuaW1wb3J0IHsgRXhlY3V0ZU1lbnVJdGVtIH0gZnJvbSAnLi90b29scy9leGVjdXRlLW1lbnUtaXRlbSc7XG5pbXBvcnQgeyBNYW5hZ2VUZXJyYWluIH0gZnJvbSAnLi90b29scy9tYW5hZ2UtdGVycmFpbic7XG4vLyBQaGFzZSA0OiBQb2xpc2ggVG9vbHNcbmltcG9ydCB7IE1hbmFnZVJlbmRlclBpcGVsaW5lIH0gZnJvbSAnLi90b29scy9tYW5hZ2UtcmVuZGVyLXBpcGVsaW5lJztcbmltcG9ydCB7IE1hbmFnZVNoYWRlckVmZmVjdCB9IGZyb20gJy4vdG9vbHMvbWFuYWdlLXNoYWRlci1lZmZlY3QnO1xuaW1wb3J0IHsgTWFuYWdlTWVzaCB9IGZyb20gJy4vdG9vbHMvbWFuYWdlLW1lc2gnO1xuaW1wb3J0IHsgTWFuYWdlUHJvZmlsZXIgfSBmcm9tICcuL3Rvb2xzL21hbmFnZS1wcm9maWxlcic7XG5pbXBvcnQgeyBNYW5hZ2VWaWRlbyB9IGZyb20gJy4vdG9vbHMvbWFuYWdlLXZpZGVvJztcbmltcG9ydCB7IE1hbmFnZUlucHV0IH0gZnJvbSAnLi90b29scy9tYW5hZ2UtaW5wdXQnO1xuaW1wb3J0IHsgQ29jb3NSZXNvdXJjZXMgfSBmcm9tICcuL3Jlc291cmNlcy9jb2Nvcy1yZXNvdXJjZXMnO1xuaW1wb3J0IHsgZW5xdWV1ZU11dGF0aW9uIH0gZnJvbSAnLi90b29scy9tdXRhdGlvbi1xdWV1ZSc7XG5cbmNvbnN0IE1BWF9CT0RZX1NJWkUgPSAxMDI0ICogMTAyNDsgLy8gMU1CIHJlcXVlc3QgYm9keSBsaW1pdFxuXG5leHBvcnQgY2xhc3MgTUNQU2VydmVyIHtcbiAgICBwcml2YXRlIHNldHRpbmdzOiBNQ1BTZXJ2ZXJTZXR0aW5ncztcbiAgICBwcml2YXRlIGh0dHBTZXJ2ZXI6IGh0dHAuU2VydmVyIHwgbnVsbCA9IG51bGw7XG4gICAgcHJpdmF0ZSB0b29sRXhlY3V0b3JzOiBNYXA8c3RyaW5nLCBBY3Rpb25Ub29sRXhlY3V0b3I+ID0gbmV3IE1hcCgpO1xuICAgIHByaXZhdGUgdG9vbERlZmluaXRpb25zOiBUb29sRGVmaW5pdGlvbltdID0gW107XG4gICAgcHJpdmF0ZSB0b29sc0xpc3Q6IFRvb2xEZWZpbml0aW9uW10gPSBbXTtcbiAgICBwcml2YXRlIGVuYWJsZWRUb29sczogc3RyaW5nW10gPSBbXTtcbiAgICBwcml2YXRlIHJlc291cmNlUHJvdmlkZXIgPSBuZXcgQ29jb3NSZXNvdXJjZXMoKTtcblxuICAgIGNvbnN0cnVjdG9yKHNldHRpbmdzOiBNQ1BTZXJ2ZXJTZXR0aW5ncykge1xuICAgICAgICB0aGlzLnNldHRpbmdzID0gc2V0dGluZ3M7XG4gICAgICAgIHRoaXMuaW5pdGlhbGl6ZVRvb2xzKCk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBpbml0aWFsaXplVG9vbHMoKTogdm9pZCB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnW01DUFNlcnZlcl0gSW5pdGlhbGl6aW5nIHYyIGFjdGlvbi1iYXNlZCB0b29scy4uLicpO1xuICAgICAgICAgICAgY29uc3QgdG9vbHM6IEFjdGlvblRvb2xFeGVjdXRvcltdID0gW1xuICAgICAgICAgICAgICAgIG5ldyBNYW5hZ2VTY2VuZSgpLFxuICAgICAgICAgICAgICAgIG5ldyBNYW5hZ2VOb2RlKCksXG4gICAgICAgICAgICAgICAgbmV3IE1hbmFnZUNvbXBvbmVudCgpLFxuICAgICAgICAgICAgICAgIG5ldyBNYW5hZ2VQcmVmYWIoKSxcbiAgICAgICAgICAgICAgICBuZXcgTWFuYWdlQXNzZXQoKSxcbiAgICAgICAgICAgICAgICBuZXcgTWFuYWdlUHJvamVjdCgpLFxuICAgICAgICAgICAgICAgIG5ldyBNYW5hZ2VEZWJ1ZygpLFxuICAgICAgICAgICAgICAgIG5ldyBNYW5hZ2VQcmVmZXJlbmNlcygpLFxuICAgICAgICAgICAgICAgIG5ldyBNYW5hZ2VTZXJ2ZXIoKSxcbiAgICAgICAgICAgICAgICBuZXcgTWFuYWdlQnJvYWRjYXN0KCksXG4gICAgICAgICAgICAgICAgbmV3IE1hbmFnZVNjZW5lVmlldygpLFxuICAgICAgICAgICAgICAgIG5ldyBNYW5hZ2VOb2RlSGllcmFyY2h5KCksXG4gICAgICAgICAgICAgICAgbmV3IE1hbmFnZVNjZW5lUXVlcnkoKSxcbiAgICAgICAgICAgICAgICBuZXcgTWFuYWdlVW5kbygpLFxuICAgICAgICAgICAgICAgIG5ldyBNYW5hZ2VSZWZlcmVuY2VJbWFnZSgpLFxuICAgICAgICAgICAgICAgIG5ldyBNYW5hZ2VWYWxpZGF0aW9uKCksXG4gICAgICAgICAgICAgICAgbmV3IE1hbmFnZVNlbGVjdGlvbigpLFxuICAgICAgICAgICAgICAgIG5ldyBNYW5hZ2VTY3JpcHQoKSxcbiAgICAgICAgICAgICAgICBuZXcgTWFuYWdlTWF0ZXJpYWwoKSxcbiAgICAgICAgICAgICAgICBuZXcgTWFuYWdlQW5pbWF0aW9uKCksXG4gICAgICAgICAgICAgICAgLy8gUGhhc2UgMTogQ29yZSBUb29sc1xuICAgICAgICAgICAgICAgIG5ldyBNYW5hZ2VMaWdodCgpLFxuICAgICAgICAgICAgICAgIG5ldyBNYW5hZ2VDYW1lcmEoKSxcbiAgICAgICAgICAgICAgICBuZXcgTWFuYWdlUGh5c2ljcygpLFxuICAgICAgICAgICAgICAgIG5ldyBNYW5hZ2VVSSgpLFxuICAgICAgICAgICAgICAgIG5ldyBCYXRjaEV4ZWN1dGUoeyBleGVjdXRlVG9vbENhbGw6IHRoaXMuZXhlY3V0ZVRvb2xDYWxsLmJpbmQodGhpcykgfSksXG4gICAgICAgICAgICAgICAgLy8gUGhhc2UgMjogR2FtZSBUb29sc1xuICAgICAgICAgICAgICAgIG5ldyBNYW5hZ2VBdWRpbygpLFxuICAgICAgICAgICAgICAgIG5ldyBNYW5hZ2VQYXJ0aWNsZSgpLFxuICAgICAgICAgICAgICAgIG5ldyBNYW5hZ2VUd2VlbigpLFxuICAgICAgICAgICAgICAgIG5ldyBNYW5hZ2VFZGl0b3IoKSxcbiAgICAgICAgICAgICAgICAvLyBQaGFzZSAzOiBTcGVjaWFsaXplZCBUb29sc1xuICAgICAgICAgICAgICAgIG5ldyBNYW5hZ2VUaWxlbWFwKCksXG4gICAgICAgICAgICAgICAgbmV3IE1hbmFnZVNwaW5lKCksXG4gICAgICAgICAgICAgICAgbmV3IE1hbmFnZURyYWdvbkJvbmVzKCksXG4gICAgICAgICAgICAgICAgbmV3IEV4ZWN1dGVNZW51SXRlbSgpLFxuICAgICAgICAgICAgICAgIG5ldyBNYW5hZ2VUZXJyYWluKCksXG4gICAgICAgICAgICAgICAgLy8gUGhhc2UgNDogUG9saXNoIFRvb2xzXG4gICAgICAgICAgICAgICAgbmV3IE1hbmFnZVJlbmRlclBpcGVsaW5lKCksXG4gICAgICAgICAgICAgICAgbmV3IE1hbmFnZVNoYWRlckVmZmVjdCgpLFxuICAgICAgICAgICAgICAgIG5ldyBNYW5hZ2VNZXNoKCksXG4gICAgICAgICAgICAgICAgbmV3IE1hbmFnZVByb2ZpbGVyKCksXG4gICAgICAgICAgICAgICAgbmV3IE1hbmFnZVZpZGVvKCksXG4gICAgICAgICAgICAgICAgbmV3IE1hbmFnZUlucHV0KCksXG4gICAgICAgICAgICBdO1xuICAgICAgICAgICAgZm9yIChjb25zdCB0b29sIG9mIHRvb2xzKSB7XG4gICAgICAgICAgICAgICAgdGhpcy50b29sRXhlY3V0b3JzLnNldCh0b29sLm5hbWUsIHRvb2wpO1xuICAgICAgICAgICAgICAgIHRoaXMudG9vbERlZmluaXRpb25zLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICBuYW1lOiB0b29sLm5hbWUsXG4gICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiB0b29sLmRlc2NyaXB0aW9uLFxuICAgICAgICAgICAgICAgICAgICBpbnB1dFNjaGVtYTogdG9vbC5pbnB1dFNjaGVtYVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc29sZS5sb2coYFtNQ1BTZXJ2ZXJdICR7dGhpcy50b29sRGVmaW5pdGlvbnMubGVuZ3RofSB2MiB0b29scyBpbml0aWFsaXplZGApO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignW01DUFNlcnZlcl0gRXJyb3IgaW5pdGlhbGl6aW5nIHRvb2xzOicsIGVycm9yKTtcbiAgICAgICAgICAgIHRocm93IGVycm9yO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIHN0YXJ0KCk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICBpZiAodGhpcy5odHRwU2VydmVyKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnW01DUFNlcnZlcl0gU2VydmVyIGlzIGFscmVhZHkgcnVubmluZycpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbTUNQU2VydmVyXSBTdGFydGluZyBIVFRQIHNlcnZlciBvbiBwb3J0ICR7dGhpcy5zZXR0aW5ncy5wb3J0fS4uLmApO1xuICAgICAgICAgICAgdGhpcy5odHRwU2VydmVyID0gaHR0cC5jcmVhdGVTZXJ2ZXIodGhpcy5oYW5kbGVIdHRwUmVxdWVzdC5iaW5kKHRoaXMpKTtcblxuICAgICAgICAgICAgYXdhaXQgbmV3IFByb21pc2U8dm9pZD4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuaHR0cFNlcnZlciEubGlzdGVuKHRoaXMuc2V0dGluZ3MucG9ydCwgJzEyNy4wLjAuMScsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtNQ1BTZXJ2ZXJdIOKchSBIVFRQIHNlcnZlciBzdGFydGVkIHN1Y2Nlc3NmdWxseSBvbiBodHRwOi8vMTI3LjAuMC4xOiR7dGhpcy5zZXR0aW5ncy5wb3J0fWApO1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW01DUFNlcnZlcl0gSGVhbHRoIGNoZWNrOiBodHRwOi8vMTI3LjAuMC4xOiR7dGhpcy5zZXR0aW5ncy5wb3J0fS9oZWFsdGhgKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtNQ1BTZXJ2ZXJdIE1DUCBlbmRwb2ludDogaHR0cDovLzEyNy4wLjAuMToke3RoaXMuc2V0dGluZ3MucG9ydH0vbWNwYCk7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB0aGlzLmh0dHBTZXJ2ZXIhLm9uKCdlcnJvcicsIChlcnI6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdbTUNQU2VydmVyXSDinYwgRmFpbGVkIHRvIHN0YXJ0IHNlcnZlcjonLCBlcnIpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoZXJyLmNvZGUgPT09ICdFQUREUklOVVNFJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihgW01DUFNlcnZlcl0gUG9ydCAke3RoaXMuc2V0dGluZ3MucG9ydH0gaXMgYWxyZWFkeSBpbiB1c2UuIFBsZWFzZSBjaGFuZ2UgdGhlIHBvcnQgaW4gc2V0dGluZ3MuYCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgdGhpcy5zZXR1cFRvb2xzKCk7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnW01DUFNlcnZlcl0g8J+agCBNQ1AgU2VydmVyIGlzIHJlYWR5IGZvciBjb25uZWN0aW9ucycpO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignW01DUFNlcnZlcl0g4p2MIEZhaWxlZCB0byBzdGFydCBzZXJ2ZXI6JywgZXJyb3IpO1xuICAgICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIHNldHVwVG9vbHMoKTogdm9pZCB7XG4gICAgICAgIHRoaXMudG9vbHNMaXN0ID0gW107XG5cbiAgICAgICAgaWYgKCF0aGlzLmVuYWJsZWRUb29scyB8fCB0aGlzLmVuYWJsZWRUb29scy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIC8vIE5vIGZpbHRlciDigJQgcmV0dXJuIGFsbCB0b29sc1xuICAgICAgICAgICAgdGhpcy50b29sc0xpc3QgPSBbLi4udGhpcy50b29sRGVmaW5pdGlvbnNdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gRmlsdGVyIGJ5IGVuYWJsZWQgdG9vbCBuYW1lc1xuICAgICAgICAgICAgY29uc3QgZW5hYmxlZFNldCA9IG5ldyBTZXQodGhpcy5lbmFibGVkVG9vbHMpO1xuICAgICAgICAgICAgdGhpcy50b29sc0xpc3QgPSB0aGlzLnRvb2xEZWZpbml0aW9ucy5maWx0ZXIodCA9PiBlbmFibGVkU2V0Lmhhcyh0Lm5hbWUpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnNvbGUubG9nKGBbTUNQU2VydmVyXSBTZXR1cCB0b29sczogJHt0aGlzLnRvb2xzTGlzdC5sZW5ndGh9IHRvb2xzIGF2YWlsYWJsZWApO1xuICAgIH1cblxuICAgIHB1YmxpYyBnZXRGaWx0ZXJlZFRvb2xzKGVuYWJsZWRUb29sczogc3RyaW5nW10pOiBUb29sRGVmaW5pdGlvbltdIHtcbiAgICAgICAgaWYgKCFlbmFibGVkVG9vbHMgfHwgZW5hYmxlZFRvb2xzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMudG9vbHNMaXN0O1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGVuYWJsZWRTZXQgPSBuZXcgU2V0KGVuYWJsZWRUb29scyk7XG4gICAgICAgIHJldHVybiB0aGlzLnRvb2xzTGlzdC5maWx0ZXIodG9vbCA9PiBlbmFibGVkU2V0Lmhhcyh0b29sLm5hbWUpKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgZXhlY3V0ZVRvb2xDYWxsKHRvb2xOYW1lOiBzdHJpbmcsIGFyZ3M6IGFueSk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIGNvbnN0IGV4ZWN1dG9yID0gdGhpcy50b29sRXhlY3V0b3JzLmdldCh0b29sTmFtZSk7XG4gICAgICAgIGlmICghZXhlY3V0b3IpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVG9vbCAnJHt0b29sTmFtZX0nIG5vdCBmb3VuZC4gQXZhaWxhYmxlOiAke0FycmF5LmZyb20odGhpcy50b29sRXhlY3V0b3JzLmtleXMoKSkuam9pbignLCAnKX1gKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCB7IGFjdGlvbiwgLi4ucmVzdEFyZ3MgfSA9IGFyZ3M7XG4gICAgICAgIGlmICghYWN0aW9uKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICAgICAgYE1pc3NpbmcgcmVxdWlyZWQgJ2FjdGlvbicgcGFyYW1ldGVyIGZvciB0b29sICcke3Rvb2xOYW1lfScuIGAgK1xuICAgICAgICAgICAgICAgIGBBdmFpbGFibGUgYWN0aW9uczogJHtleGVjdXRvci5hY3Rpb25zLmpvaW4oJywgJyl9YFxuICAgICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgICAvLyAjNjogdG9vbCBjYWxscyBpc3N1ZWQgY29uY3VycmVudGx5IGJ5IGEgY2xpZW50IGludGVybGVhdmUgaW5zaWRlIHRoZSBlZGl0b3IsIHNvIGFcbiAgICAgICAgLy8gc2F2ZSBjYW4gcnVuIHdoaWxlIGEgYG1hbmFnZV9ub2RlIGNyZWF0ZWAgaXMgc3RpbGwgY29tbWl0dGluZyBhbmQgc2lsZW50bHkgZHJvcCBpdC5cbiAgICAgICAgLy8gU2VyaWFsaXppbmcgZXZlcnkgY2FsbCBvbiBvbmUgY2hhaW4gaGVyZSDigJQgdGhlIHNpbmdsZSBkaXNwYXRjaCBwb2ludCBldmVyeSB0b29sXG4gICAgICAgIC8vIGNhbGwgcGFzc2VzIHRocm91Z2gg4oCUIGlzIHdoYXQgcHJldmVudHMgdGhhdCByYWNlOyB2ZXJpZnlpbmcgdGhlIHNhdmUgYWZ0ZXJ3YXJkc1xuICAgICAgICAvLyBvbmx5IGRldGVjdHMgaXQuIFJlLWVudHJhbnQgdG9vbHMgcnVuIGRpcmVjdGx5OiBiYXRjaF9leGVjdXRlIGNhbGxzIGJhY2sgaW50byB0aGlzXG4gICAgICAgIC8vIG1ldGhvZCBwZXIgZW50cnksIHNvIGVucXVldWVpbmcgaXQgd291bGQgZGVhZGxvY2sgaXQgYmVoaW5kIGl0cyBvd24gc2xvdCwgYW5kIGl0c1xuICAgICAgICAvLyBpbm5lciBjYWxscyBhcmUgZWFjaCBzZXJpYWxpemVkIG9uIHRoZWlyIG93biBhbnl3YXkuXG4gICAgICAgIGlmIChleGVjdXRvci5yZWVudHJhbnQpIHtcbiAgICAgICAgICAgIHJldHVybiBhd2FpdCBleGVjdXRvci5leGVjdXRlKGFjdGlvbiwgcmVzdEFyZ3MpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBhd2FpdCBlbnF1ZXVlTXV0YXRpb24oKCkgPT4gZXhlY3V0b3IuZXhlY3V0ZShhY3Rpb24sIHJlc3RBcmdzKSk7XG4gICAgfVxuXG4gICAgcHVibGljIGdldEF2YWlsYWJsZVRvb2xzKCk6IFRvb2xEZWZpbml0aW9uW10ge1xuICAgICAgICByZXR1cm4gdGhpcy50b29sc0xpc3Q7XG4gICAgfVxuXG4gICAgcHVibGljIHVwZGF0ZUVuYWJsZWRUb29scyhlbmFibGVkVG9vbHM6IHN0cmluZ1tdKTogdm9pZCB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbTUNQU2VydmVyXSBVcGRhdGluZyBlbmFibGVkIHRvb2xzOiAke2VuYWJsZWRUb29scy5sZW5ndGh9IHRvb2xzYCk7XG4gICAgICAgIHRoaXMuZW5hYmxlZFRvb2xzID0gZW5hYmxlZFRvb2xzO1xuICAgICAgICB0aGlzLnNldHVwVG9vbHMoKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgZ2V0U2V0dGluZ3MoKTogTUNQU2VydmVyU2V0dGluZ3Mge1xuICAgICAgICByZXR1cm4gdGhpcy5zZXR0aW5ncztcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGhhbmRsZUh0dHBSZXF1ZXN0KHJlcTogaHR0cC5JbmNvbWluZ01lc3NhZ2UsIHJlczogaHR0cC5TZXJ2ZXJSZXNwb25zZSk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICBjb25zdCBwYXJzZWRVcmwgPSB1cmwucGFyc2UocmVxLnVybCB8fCAnJywgdHJ1ZSk7XG4gICAgICAgIGNvbnN0IHBhdGhuYW1lID0gcGFyc2VkVXJsLnBhdGhuYW1lO1xuICAgICAgICBcbiAgICAgICAgLy8gU2V0IENPUlMgaGVhZGVycyDigJQgZW5mb3JjZSBhbGxvd2VkT3JpZ2lucyBpZiBjb25maWd1cmVkXG4gICAgICAgIGNvbnN0IG9yaWdpbiA9IHJlcS5oZWFkZXJzLm9yaWdpbjtcbiAgICAgICAgY29uc3QgYWxsb3dlZE9yaWdpbnMgPSB0aGlzLnNldHRpbmdzLmFsbG93ZWRPcmlnaW5zO1xuICAgICAgICBpZiAoIWFsbG93ZWRPcmlnaW5zIHx8IGFsbG93ZWRPcmlnaW5zLmxlbmd0aCA9PT0gMCB8fCBhbGxvd2VkT3JpZ2lucy5pbmNsdWRlcygnKicpKSB7XG4gICAgICAgICAgICByZXMuc2V0SGVhZGVyKCdBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nLCAnKicpO1xuICAgICAgICB9IGVsc2UgaWYgKG9yaWdpbiAmJiBhbGxvd2VkT3JpZ2lucy5pbmNsdWRlcyhvcmlnaW4pKSB7XG4gICAgICAgICAgICByZXMuc2V0SGVhZGVyKCdBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nLCBvcmlnaW4pO1xuICAgICAgICAgICAgcmVzLnNldEhlYWRlcignVmFyeScsICdPcmlnaW4nKTtcbiAgICAgICAgfSBlbHNlIGlmIChvcmlnaW4gJiYgYWxsb3dlZE9yaWdpbnMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgLy8gT3JpZ2luIG5vdCBpbiBhbGxvd2VkT3JpZ2lucyDigJQgcmVqZWN0IHdpdGggNDAzXG4gICAgICAgICAgICByZXMud3JpdGVIZWFkKDQwMywgeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0pO1xuICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiAnT3JpZ2luIG5vdCBhbGxvd2VkJyB9KSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgLy8gTm8gb3JpZ2luIGhlYWRlciAobm9uLWJyb3dzZXIgY2xpZW50cyBsaWtlIGN1cmwsIE1DUCBjbGllbnRzKSDigJQgYWxsb3cgdGhyb3VnaFxuICAgICAgICByZXMuc2V0SGVhZGVyKCdBY2Nlc3MtQ29udHJvbC1BbGxvdy1NZXRob2RzJywgJ0dFVCwgUE9TVCwgT1BUSU9OUycpO1xuICAgICAgICByZXMuc2V0SGVhZGVyKCdBY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzJywgJ0NvbnRlbnQtVHlwZSwgQXV0aG9yaXphdGlvbicpO1xuICAgICAgICByZXMuc2V0SGVhZGVyKCdDb250ZW50LVR5cGUnLCAnYXBwbGljYXRpb24vanNvbicpO1xuICAgICAgICBcbiAgICAgICAgaWYgKHJlcS5tZXRob2QgPT09ICdPUFRJT05TJykge1xuICAgICAgICAgICAgaWYgKCFyZXMud3JpdGFibGVFbmRlZCkgeyByZXMud3JpdGVIZWFkKDIwMCk7IHJlcy5lbmQoKTsgfVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGlmIChwYXRobmFtZSA9PT0gJy9tY3AnICYmIHJlcS5tZXRob2QgPT09ICdQT1NUJykge1xuICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuaGFuZGxlTUNQUmVxdWVzdChyZXEsIHJlcyk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHBhdGhuYW1lID09PSAnL2hlYWx0aCcgJiYgcmVxLm1ldGhvZCA9PT0gJ0dFVCcpIHtcbiAgICAgICAgICAgICAgICBpZiAoIXJlcy53cml0YWJsZUVuZGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlcy53cml0ZUhlYWQoMjAwKTtcbiAgICAgICAgICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN0YXR1czogJ29rJywgdG9vbHM6IHRoaXMudG9vbHNMaXN0Lmxlbmd0aCB9KSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChwYXRobmFtZT8uc3RhcnRzV2l0aCgnL2FwaS8nKSAmJiByZXEubWV0aG9kID09PSAnUE9TVCcpIHtcbiAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLmhhbmRsZVNpbXBsZUFQSVJlcXVlc3QocmVxLCByZXMsIHBhdGhuYW1lKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAocGF0aG5hbWUgPT09ICcvYXBpL3Rvb2xzJyAmJiByZXEubWV0aG9kID09PSAnR0VUJykge1xuICAgICAgICAgICAgICAgIGlmICghcmVzLndyaXRhYmxlRW5kZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzLndyaXRlSGVhZCgyMDApO1xuICAgICAgICAgICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgdG9vbHM6IHRoaXMuZ2V0U2ltcGxpZmllZFRvb2xzTGlzdCgpIH0pKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmICghcmVzLndyaXRhYmxlRW5kZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzLndyaXRlSGVhZCg0MDQpO1xuICAgICAgICAgICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6ICdOb3QgZm91bmQnIH0pKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdIVFRQIHJlcXVlc3QgZXJyb3I6JywgZXJyb3IpO1xuICAgICAgICAgICAgaWYgKCFyZXMud3JpdGFibGVFbmRlZCkge1xuICAgICAgICAgICAgICAgIHJlcy53cml0ZUhlYWQoNTAwKTtcbiAgICAgICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6ICdJbnRlcm5hbCBzZXJ2ZXIgZXJyb3InIH0pKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICBcbiAgICBwcml2YXRlIGFzeW5jIGhhbmRsZU1DUFJlcXVlc3QocmVxOiBodHRwLkluY29taW5nTWVzc2FnZSwgcmVzOiBodHRwLlNlcnZlclJlc3BvbnNlKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIGxldCBib2R5ID0gJyc7XG4gICAgICAgIGxldCBib2R5U2l6ZSA9IDA7XG5cbiAgICAgICAgcmVxLm9uKCdkYXRhJywgKGNodW5rOiBCdWZmZXIpID0+IHtcbiAgICAgICAgICAgIGJvZHlTaXplICs9IGNodW5rLmxlbmd0aDtcbiAgICAgICAgICAgIGlmIChib2R5U2l6ZSA+IE1BWF9CT0RZX1NJWkUpIHtcbiAgICAgICAgICAgICAgICByZXEuZGVzdHJveSgpO1xuICAgICAgICAgICAgICAgIGlmICghcmVzLndyaXRhYmxlRW5kZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzLndyaXRlSGVhZCg0MTMpO1xuICAgICAgICAgICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6ICdSZXF1ZXN0IGJvZHkgdG9vIGxhcmdlJyB9KSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJvZHkgKz0gY2h1bmsudG9TdHJpbmcoKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmVxLm9uKCdlbmQnLCBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICBpZiAocmVzLndyaXRhYmxlRW5kZWQpIHJldHVybjtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWVzc2FnZSA9IEpTT04ucGFyc2UoYm9keSk7XG5cbiAgICAgICAgICAgICAgICAvLyBKU09OLVJQQyAyLjAgdmFsaWRhdGlvblxuICAgICAgICAgICAgICAgIGlmICghbWVzc2FnZS5qc29ucnBjIHx8IG1lc3NhZ2UuanNvbnJwYyAhPT0gJzIuMCcpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzLndyaXRlSGVhZCgyMDApO1xuICAgICAgICAgICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICAgICAgICAgICAgICAgICAgaWQ6IG1lc3NhZ2UuaWQgPz8gbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGVycm9yOiB7IGNvZGU6IC0zMjYwMCwgbWVzc2FnZTogJ0ludmFsaWQgUmVxdWVzdDogbWlzc2luZyBqc29ucnBjIGZpZWxkJyB9XG4gICAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgdGhpcy5oYW5kbGVNZXNzYWdlKG1lc3NhZ2UpO1xuICAgICAgICAgICAgICAgIGlmICghcmVzLndyaXRhYmxlRW5kZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzLndyaXRlSGVhZCgyMDApO1xuICAgICAgICAgICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHJlc3BvbnNlKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGhhbmRsaW5nIE1DUCByZXF1ZXN0OicsIGVycm9yKTtcbiAgICAgICAgICAgICAgICBpZiAoIXJlcy53cml0YWJsZUVuZGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlcy53cml0ZUhlYWQoNDAwKTtcbiAgICAgICAgICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGlkOiBudWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgZXJyb3I6IHsgY29kZTogLTMyNzAwLCBtZXNzYWdlOiBgUGFyc2UgZXJyb3I6ICR7ZXJyb3IubWVzc2FnZX1gIH1cbiAgICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBoYW5kbGVNZXNzYWdlKG1lc3NhZ2U6IGFueSk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIGNvbnN0IHsgaWQsIG1ldGhvZCwgcGFyYW1zIH0gPSBtZXNzYWdlO1xuICAgICAgICBpZiAodGhpcy5zZXR0aW5ncy5lbmFibGVEZWJ1Z0xvZykge1xuICAgICAgICAgICAgY29uc29sZS5sb2coYFtNQ1BTZXJ2ZXJdIFtkZWJ1Z10gbWV0aG9kPSR7bWV0aG9kfSBpZD0ke2lkfWApO1xuICAgICAgICB9XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGxldCByZXN1bHQ6IGFueTtcblxuICAgICAgICAgICAgc3dpdGNoIChtZXRob2QpIHtcbiAgICAgICAgICAgICAgICBjYXNlICd0b29scy9saXN0JzpcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0ID0geyB0b29sczogdGhpcy5nZXRBdmFpbGFibGVUb29scygpIH07XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgJ3Rvb2xzL2NhbGwnOiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHsgbmFtZSwgYXJndW1lbnRzOiBjYWxsQXJncyB9ID0gcGFyYW1zO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB0b29sUmVzdWx0ID0gYXdhaXQgdGhpcy5leGVjdXRlVG9vbENhbGwobmFtZSwgY2FsbEFyZ3MpO1xuICAgICAgICAgICAgICAgICAgICByZXN1bHQgPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250ZW50OiBbeyB0eXBlOiAndGV4dCcsIHRleHQ6IEpTT04uc3RyaW5naWZ5KHRvb2xSZXN1bHQpIH1dLFxuICAgICAgICAgICAgICAgICAgICAgICAgaXNFcnJvcjogdG9vbFJlc3VsdC5pc0Vycm9yIHx8IGZhbHNlXG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXNlICdyZXNvdXJjZXMvbGlzdCc6XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdCA9IHsgcmVzb3VyY2VzOiB0aGlzLnJlc291cmNlUHJvdmlkZXIucmVzb3VyY2VzIH07XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgJ3Jlc291cmNlcy9yZWFkJzoge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB7IHVyaSB9ID0gcGFyYW1zO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5yZXNvdXJjZVByb3ZpZGVyLnJlYWQodXJpKTtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0ID0geyBjb250ZW50czogW2NvbnRlbnRdIH07XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXNlICdpbml0aWFsaXplJzpcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0ID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgcHJvdG9jb2xWZXJzaW9uOiAnMjAyNC0xMS0wNScsXG4gICAgICAgICAgICAgICAgICAgICAgICBjYXBhYmlsaXRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0b29sczoge30sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2VzOiB7fVxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlcnZlckluZm86IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiAnY29jb3MtbWNwLXNlcnZlcicsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmVyc2lvbjogJzIuMC4wJ1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgICAgICAgICAgICAgICAgICBpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGVycm9yOiB7IGNvZGU6IC0zMjYwMSwgbWVzc2FnZTogYE1ldGhvZCBub3QgZm91bmQ6ICR7bWV0aG9kfWAgfVxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICAgICAgICAgIGlkLFxuICAgICAgICAgICAgICAgIHJlc3VsdFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgICAgICAgICBpZCxcbiAgICAgICAgICAgICAgICBlcnJvcjoge1xuICAgICAgICAgICAgICAgICAgICBjb2RlOiAtMzI2MDMsXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGVycm9yLm1lc3NhZ2VcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHVibGljIHN0b3AoKTogdm9pZCB7XG4gICAgICAgIGlmICh0aGlzLmh0dHBTZXJ2ZXIpIHtcbiAgICAgICAgICAgIHRoaXMuaHR0cFNlcnZlci5jbG9zZSgpO1xuICAgICAgICAgICAgdGhpcy5odHRwU2VydmVyID0gbnVsbDtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdbTUNQU2VydmVyXSBIVFRQIHNlcnZlciBzdG9wcGVkJyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwdWJsaWMgZ2V0U3RhdHVzKCk6IFNlcnZlclN0YXR1cyB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBydW5uaW5nOiAhIXRoaXMuaHR0cFNlcnZlcixcbiAgICAgICAgICAgIHBvcnQ6IHRoaXMuc2V0dGluZ3MucG9ydCxcbiAgICAgICAgICAgIGNsaWVudHM6IDAgLy8gSFRUUCBpcyBzdGF0ZWxlc3MsIG5vIHBlcnNpc3RlbnQgY2xpZW50c1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgaGFuZGxlU2ltcGxlQVBJUmVxdWVzdChyZXE6IGh0dHAuSW5jb21pbmdNZXNzYWdlLCByZXM6IGh0dHAuU2VydmVyUmVzcG9uc2UsIHBhdGhuYW1lOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgbGV0IGJvZHkgPSAnJztcbiAgICAgICAgbGV0IGJvZHlTaXplID0gMDtcblxuICAgICAgICByZXEub24oJ2RhdGEnLCAoY2h1bms6IEJ1ZmZlcikgPT4ge1xuICAgICAgICAgICAgYm9keVNpemUgKz0gY2h1bmsubGVuZ3RoO1xuICAgICAgICAgICAgaWYgKGJvZHlTaXplID4gTUFYX0JPRFlfU0laRSkge1xuICAgICAgICAgICAgICAgIHJlcS5kZXN0cm95KCk7XG4gICAgICAgICAgICAgICAgaWYgKCFyZXMud3JpdGFibGVFbmRlZCkge1xuICAgICAgICAgICAgICAgICAgICByZXMud3JpdGVIZWFkKDQxMyk7XG4gICAgICAgICAgICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogJ1JlcXVlc3QgYm9keSB0b28gbGFyZ2UnIH0pKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYm9keSArPSBjaHVuay50b1N0cmluZygpO1xuICAgICAgICB9KTtcblxuICAgICAgICByZXEub24oJ2VuZCcsIGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgIGlmIChyZXMud3JpdGFibGVFbmRlZCkgcmV0dXJuO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAvLyBFeHRyYWN0IHRvb2wgbmFtZSBmcm9tIHBhdGggbGlrZSAvYXBpL21hbmFnZV9ub2RlXG4gICAgICAgICAgICAgICAgY29uc3QgcGF0aFBhcnRzID0gcGF0aG5hbWUuc3BsaXQoJy8nKS5maWx0ZXIocCA9PiBwKTtcbiAgICAgICAgICAgICAgICBpZiAocGF0aFBhcnRzLmxlbmd0aCA8IDIpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzLndyaXRlSGVhZCg0MDApO1xuICAgICAgICAgICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6ICdJbnZhbGlkIEFQSSBwYXRoLiBVc2UgL2FwaS97dG9vbF9uYW1lfScgfSkpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgZnVsbFRvb2xOYW1lID0gcGF0aFBhcnRzLnNsaWNlKDEpLmpvaW4oJ18nKTtcblxuICAgICAgICAgICAgICAgIGxldCBwYXJhbXM6IGFueTtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBwYXJhbXMgPSBib2R5ID8gSlNPTi5wYXJzZShib2R5KSA6IHt9O1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKHBhcnNlRXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICByZXMud3JpdGVIZWFkKDQwMCk7XG4gICAgICAgICAgICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgICAgICAgICAgZXJyb3I6ICdJbnZhbGlkIEpTT04gaW4gcmVxdWVzdCBib2R5JyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRldGFpbHM6IHBhcnNlRXJyb3IubWVzc2FnZVxuICAgICAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmV4ZWN1dGVUb29sQ2FsbChmdWxsVG9vbE5hbWUsIHBhcmFtcyk7XG5cbiAgICAgICAgICAgICAgICBpZiAoIXJlcy53cml0YWJsZUVuZGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlcy53cml0ZUhlYWQoMjAwKTtcbiAgICAgICAgICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IHRydWUsIHRvb2w6IGZ1bGxUb29sTmFtZSwgcmVzdWx0IH0pKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignU2ltcGxlIEFQSSBlcnJvcjonLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgaWYgKCFyZXMud3JpdGFibGVFbmRlZCkge1xuICAgICAgICAgICAgICAgICAgICByZXMud3JpdGVIZWFkKDUwMCk7XG4gICAgICAgICAgICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UsIHRvb2w6IHBhdGhuYW1lIH0pKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHByaXZhdGUgZ2V0U2ltcGxpZmllZFRvb2xzTGlzdCgpOiBhbnlbXSB7XG4gICAgICAgIHJldHVybiB0aGlzLnRvb2xzTGlzdC5tYXAodG9vbCA9PiB7XG4gICAgICAgICAgICBjb25zdCBleGVjdXRvciA9IHRoaXMudG9vbEV4ZWN1dG9ycy5nZXQodG9vbC5uYW1lKTtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgbmFtZTogdG9vbC5uYW1lLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiB0b29sLmRlc2NyaXB0aW9uLFxuICAgICAgICAgICAgICAgIGFjdGlvbnM6IGV4ZWN1dG9yID8gZXhlY3V0b3IuYWN0aW9ucyA6IFtdLFxuICAgICAgICAgICAgICAgIGFwaVBhdGg6IGAvYXBpLyR7dG9vbC5uYW1lfWAsXG4gICAgICAgICAgICAgICAgY3VybEV4YW1wbGU6IHRoaXMuZ2VuZXJhdGVDdXJsRXhhbXBsZSh0b29sLm5hbWUsIHRvb2wuaW5wdXRTY2hlbWEpXG4gICAgICAgICAgICB9O1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGdlbmVyYXRlQ3VybEV4YW1wbGUodG9vbE5hbWU6IHN0cmluZywgc2NoZW1hOiBhbnkpOiBzdHJpbmcge1xuICAgICAgICBjb25zdCBzYW1wbGVQYXJhbXMgPSB0aGlzLmdlbmVyYXRlU2FtcGxlUGFyYW1zKHNjaGVtYSk7XG4gICAgICAgIGNvbnN0IGpzb25TdHJpbmcgPSBKU09OLnN0cmluZ2lmeShzYW1wbGVQYXJhbXMsIG51bGwsIDIpO1xuXG4gICAgICAgIHJldHVybiBgY3VybCAtWCBQT1NUIGh0dHA6Ly8xMjcuMC4wLjE6JHt0aGlzLnNldHRpbmdzLnBvcnR9L2FwaS8ke3Rvb2xOYW1lfSBcXFxcXG4gIC1IIFwiQ29udGVudC1UeXBlOiBhcHBsaWNhdGlvbi9qc29uXCIgXFxcXFxuICAtZCAnJHtqc29uU3RyaW5nfSdgO1xuICAgIH1cblxuICAgIHByaXZhdGUgZ2VuZXJhdGVTYW1wbGVQYXJhbXMoc2NoZW1hOiBhbnkpOiBhbnkge1xuICAgICAgICBpZiAoIXNjaGVtYSB8fCAhc2NoZW1hLnByb3BlcnRpZXMpIHJldHVybiB7fTtcbiAgICAgICAgXG4gICAgICAgIGNvbnN0IHNhbXBsZTogYW55ID0ge307XG4gICAgICAgIGZvciAoY29uc3QgW2tleSwgcHJvcF0gb2YgT2JqZWN0LmVudHJpZXMoc2NoZW1hLnByb3BlcnRpZXMgYXMgYW55KSkge1xuICAgICAgICAgICAgY29uc3QgcHJvcFNjaGVtYSA9IHByb3AgYXMgYW55O1xuICAgICAgICAgICAgc3dpdGNoIChwcm9wU2NoZW1hLnR5cGUpIHtcbiAgICAgICAgICAgICAgICBjYXNlICdzdHJpbmcnOlxuICAgICAgICAgICAgICAgICAgICBzYW1wbGVba2V5XSA9IHByb3BTY2hlbWEuZGVmYXVsdCB8fCAnZXhhbXBsZV9zdHJpbmcnO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlICdudW1iZXInOlxuICAgICAgICAgICAgICAgICAgICBzYW1wbGVba2V5XSA9IHByb3BTY2hlbWEuZGVmYXVsdCB8fCA0MjtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSAnYm9vbGVhbic6XG4gICAgICAgICAgICAgICAgICAgIHNhbXBsZVtrZXldID0gcHJvcFNjaGVtYS5kZWZhdWx0IHx8IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgJ29iamVjdCc6XG4gICAgICAgICAgICAgICAgICAgIHNhbXBsZVtrZXldID0gcHJvcFNjaGVtYS5kZWZhdWx0IHx8IHsgeDogMCwgeTogMCwgejogMCB9O1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgICBzYW1wbGVba2V5XSA9ICdleGFtcGxlX3ZhbHVlJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gc2FtcGxlO1xuICAgIH1cblxuICAgIHB1YmxpYyB1cGRhdGVTZXR0aW5ncyhzZXR0aW5nczogTUNQU2VydmVyU2V0dGluZ3MpOiB2b2lkIHtcbiAgICAgICAgdGhpcy5zZXR0aW5ncyA9IHNldHRpbmdzO1xuICAgICAgICBpZiAodGhpcy5odHRwU2VydmVyKSB7XG4gICAgICAgICAgICB0aGlzLnN0b3AoKTtcbiAgICAgICAgICAgIHRoaXMuc3RhcnQoKS5jYXRjaChlcnIgPT4gY29uc29sZS5lcnJvcignW01DUFNlcnZlcl0gRmFpbGVkIHRvIHJlc3RhcnQgYWZ0ZXIgc2V0dGluZ3MgdXBkYXRlOicsIGVycikpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG4vLyBIVFRQIHRyYW5zcG9ydCBkb2Vzbid0IG5lZWQgcGVyc2lzdGVudCBjb25uZWN0aW9uc1xuLy8gTUNQIG92ZXIgSFRUUCB1c2VzIHJlcXVlc3QtcmVzcG9uc2UgcGF0dGVybiJdfQ==