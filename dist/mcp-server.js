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
        return await executor.execute(action, restArgs);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwLXNlcnZlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NvdXJjZS9tY3Atc2VydmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsMkNBQTZCO0FBQzdCLHlDQUEyQjtBQUUzQix1REFBbUQ7QUFDbkQscURBQWlEO0FBQ2pELCtEQUEyRDtBQUMzRCx5REFBcUQ7QUFDckQsdURBQW1EO0FBQ25ELDJEQUF1RDtBQUN2RCx1REFBbUQ7QUFDbkQsbUVBQStEO0FBQy9ELHlEQUFxRDtBQUNyRCwrREFBMkQ7QUFDM0QsaUVBQTREO0FBQzVELHlFQUFvRTtBQUNwRSxtRUFBOEQ7QUFDOUQscURBQWlEO0FBQ2pELDJFQUFzRTtBQUN0RSxpRUFBNkQ7QUFDN0QsK0RBQTJEO0FBQzNELHlEQUFxRDtBQUNyRCw2REFBeUQ7QUFDekQsK0RBQTJEO0FBQzNELHNCQUFzQjtBQUN0Qix1REFBbUQ7QUFDbkQseURBQXFEO0FBQ3JELDJEQUF1RDtBQUN2RCxpREFBNkM7QUFDN0MseURBQXFEO0FBQ3JELHNCQUFzQjtBQUN0Qix1REFBbUQ7QUFDbkQsNkRBQXlEO0FBQ3pELHVEQUFtRDtBQUNuRCx5REFBcUQ7QUFDckQsNkJBQTZCO0FBQzdCLDJEQUF1RDtBQUN2RCx1REFBbUQ7QUFDbkQsbUVBQStEO0FBQy9ELGlFQUE0RDtBQUM1RCwyREFBdUQ7QUFDdkQsd0JBQXdCO0FBQ3hCLDJFQUFzRTtBQUN0RSx1RUFBa0U7QUFDbEUscURBQWlEO0FBQ2pELDZEQUF5RDtBQUN6RCx1REFBbUQ7QUFDbkQsdURBQW1EO0FBQ25ELGlFQUE2RDtBQUU3RCxNQUFNLGFBQWEsR0FBRyxJQUFJLEdBQUcsSUFBSSxDQUFDLENBQUMseUJBQXlCO0FBRTVELE1BQWEsU0FBUztJQVNsQixZQUFZLFFBQTJCO1FBUC9CLGVBQVUsR0FBdUIsSUFBSSxDQUFDO1FBQ3RDLGtCQUFhLEdBQW9D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UTtvQkFDVCxNQUFNLENBQUMsR0FBRyxDQUFDLEdBQUcsVUFBVSxDQUFDLE9BQU8sSUFBSSxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUM7b0JBQ3pELE1BQU07Z0JBQ1Y7b0JBQ0ksTUFBTSxDQUFDLEdBQUcsQ0FBQyxHQUFHLGVBQWUsQ0FBQztZQUN0QyxDQUFDO1FBQ0wsQ0FBQztRQUNELE9BQU8sTUFBTSxDQUFDO0lBQ2xCLENBQUM7SUFFTSxjQUFjLENBQUMsUUFBMkI7UUFDN0MsSUFBSSxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUM7UUFDekIsSUFBSSxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7WUFDbEIsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO1lBQ1osSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsc0RBQXNELEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUMxRyxDQUFDO0lBQ0wsQ0FBQztDQUNKO0FBeGRELDhCQXdkQztBQUVELHFEQUFxRDtBQUNyRCw4Q0FBOEMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBodHRwIGZyb20gJ2h0dHAnO1xyXG5pbXBvcnQgKiBhcyB1cmwgZnJvbSAndXJsJztcclxuaW1wb3J0IHsgTUNQU2VydmVyU2V0dGluZ3MsIFNlcnZlclN0YXR1cywgVG9vbERlZmluaXRpb24sIEFjdGlvblRvb2xFeGVjdXRvciB9IGZyb20gJy4vdHlwZXMnO1xyXG5pbXBvcnQgeyBNYW5hZ2VTY2VuZSB9IGZyb20gJy4vdG9vbHMvbWFuYWdlLXNjZW5lJztcclxuaW1wb3J0IHsgTWFuYWdlTm9kZSB9IGZyb20gJy4vdG9vbHMvbWFuYWdlLW5vZGUnO1xyXG5pbXBvcnQgeyBNYW5hZ2VDb21wb25lbnQgfSBmcm9tICcuL3Rvb2xzL21hbmFnZS1jb21wb25lbnQnO1xyXG5pbXBvcnQgeyBNYW5hZ2VQcmVmYWIgfSBmcm9tICcuL3Rvb2xzL21hbmFnZS1wcmVmYWInO1xyXG5pbXBvcnQgeyBNYW5hZ2VBc3NldCB9IGZyb20gJy4vdG9vbHMvbWFuYWdlLWFzc2V0JztcclxuaW1wb3J0IHsgTWFuYWdlUHJvamVjdCB9IGZyb20gJy4vdG9vbHMvbWFuYWdlLXByb2plY3QnO1xyXG5pbXBvcnQgeyBNYW5hZ2VEZWJ1ZyB9IGZyb20gJy4vdG9vbHMvbWFuYWdlLWRlYnVnJztcclxuaW1wb3J0IHsgTWFuYWdlUHJlZmVyZW5jZXMgfSBmcm9tICcuL3Rvb2xzL21hbmFnZS1wcmVmZXJlbmNlcyc7XHJcbmltcG9ydCB7IE1hbmFnZVNlcnZlciB9IGZyb20gJy4vdG9vbHMvbWFuYWdlLXNlcnZlcic7XHJcbmltcG9ydCB7IE1hbmFnZUJyb2FkY2FzdCB9IGZyb20gJy4vdG9vbHMvbWFuYWdlLWJyb2FkY2FzdCc7XHJcbmltcG9ydCB7IE1hbmFnZVNjZW5lVmlldyB9IGZyb20gJy4vdG9vbHMvbWFuYWdlLXNjZW5lLXZpZXcnO1xyXG5pbXBvcnQgeyBNYW5hZ2VOb2RlSGllcmFyY2h5IH0gZnJvbSAnLi90b29scy9tYW5hZ2Utbm9kZS1oaWVyYXJjaHknO1xyXG5pbXBvcnQgeyBNYW5hZ2VTY2VuZVF1ZXJ5IH0gZnJvbSAnLi90b29scy9tYW5hZ2Utc2NlbmUtcXVlcnknO1xyXG5pbXBvcnQgeyBNYW5hZ2VVbmRvIH0gZnJvbSAnLi90b29scy9tYW5hZ2UtdW5kbyc7XHJcbmltcG9ydCB7IE1hbmFnZVJlZmVyZW5jZUltYWdlIH0gZnJvbSAnLi90b29scy9tYW5hZ2UtcmVmZXJlbmNlLWltYWdlJztcclxuaW1wb3J0IHsgTWFuYWdlVmFsaWRhdGlvbiB9IGZyb20gJy4vdG9vbHMvbWFuYWdlLXZhbGlkYXRpb24nO1xyXG5pbXBvcnQgeyBNYW5hZ2VTZWxlY3Rpb24gfSBmcm9tICcuL3Rvb2xzL21hbmFnZS1zZWxlY3Rpb24nO1xyXG5pbXBvcnQgeyBNYW5hZ2VTY3JpcHQgfSBmcm9tICcuL3Rvb2xzL21hbmFnZS1zY3JpcHQnO1xyXG5pbXBvcnQgeyBNYW5hZ2VNYXRlcmlhbCB9IGZyb20gJy4vdG9vbHMvbWFuYWdlLW1hdGVyaWFsJztcclxuaW1wb3J0IHsgTWFuYWdlQW5pbWF0aW9uIH0gZnJvbSAnLi90b29scy9tYW5hZ2UtYW5pbWF0aW9uJztcclxuLy8gUGhhc2UgMTogQ29yZSBUb29sc1xyXG5pbXBvcnQgeyBNYW5hZ2VMaWdodCB9IGZyb20gJy4vdG9vbHMvbWFuYWdlLWxpZ2h0JztcclxuaW1wb3J0IHsgTWFuYWdlQ2FtZXJhIH0gZnJvbSAnLi90b29scy9tYW5hZ2UtY2FtZXJhJztcclxuaW1wb3J0IHsgTWFuYWdlUGh5c2ljcyB9IGZyb20gJy4vdG9vbHMvbWFuYWdlLXBoeXNpY3MnO1xyXG5pbXBvcnQgeyBNYW5hZ2VVSSB9IGZyb20gJy4vdG9vbHMvbWFuYWdlLXVpJztcclxuaW1wb3J0IHsgQmF0Y2hFeGVjdXRlIH0gZnJvbSAnLi90b29scy9iYXRjaC1leGVjdXRlJztcclxuLy8gUGhhc2UgMjogR2FtZSBUb29sc1xyXG5pbXBvcnQgeyBNYW5hZ2VBdWRpbyB9IGZyb20gJy4vdG9vbHMvbWFuYWdlLWF1ZGlvJztcclxuaW1wb3J0IHsgTWFuYWdlUGFydGljbGUgfSBmcm9tICcuL3Rvb2xzL21hbmFnZS1wYXJ0aWNsZSc7XHJcbmltcG9ydCB7IE1hbmFnZVR3ZWVuIH0gZnJvbSAnLi90b29scy9tYW5hZ2UtdHdlZW4nO1xyXG5pbXBvcnQgeyBNYW5hZ2VFZGl0b3IgfSBmcm9tICcuL3Rvb2xzL21hbmFnZS1lZGl0b3InO1xyXG4vLyBQaGFzZSAzOiBTcGVjaWFsaXplZCBUb29sc1xyXG5pbXBvcnQgeyBNYW5hZ2VUaWxlbWFwIH0gZnJvbSAnLi90b29scy9tYW5hZ2UtdGlsZW1hcCc7XHJcbmltcG9ydCB7IE1hbmFnZVNwaW5lIH0gZnJvbSAnLi90b29scy9tYW5hZ2Utc3BpbmUnO1xyXG5pbXBvcnQgeyBNYW5hZ2VEcmFnb25Cb25lcyB9IGZyb20gJy4vdG9vbHMvbWFuYWdlLWRyYWdvbmJvbmVzJztcclxuaW1wb3J0IHsgRXhlY3V0ZU1lbnVJdGVtIH0gZnJvbSAnLi90b29scy9leGVjdXRlLW1lbnUtaXRlbSc7XHJcbmltcG9ydCB7IE1hbmFnZVRlcnJhaW4gfSBmcm9tICcuL3Rvb2xzL21hbmFnZS10ZXJyYWluJztcclxuLy8gUGhhc2UgNDogUG9saXNoIFRvb2xzXHJcbmltcG9ydCB7IE1hbmFnZVJlbmRlclBpcGVsaW5lIH0gZnJvbSAnLi90b29scy9tYW5hZ2UtcmVuZGVyLXBpcGVsaW5lJztcclxuaW1wb3J0IHsgTWFuYWdlU2hhZGVyRWZmZWN0IH0gZnJvbSAnLi90b29scy9tYW5hZ2Utc2hhZGVyLWVmZmVjdCc7XHJcbmltcG9ydCB7IE1hbmFnZU1lc2ggfSBmcm9tICcuL3Rvb2xzL21hbmFnZS1tZXNoJztcclxuaW1wb3J0IHsgTWFuYWdlUHJvZmlsZXIgfSBmcm9tICcuL3Rvb2xzL21hbmFnZS1wcm9maWxlcic7XHJcbmltcG9ydCB7IE1hbmFnZVZpZGVvIH0gZnJvbSAnLi90b29scy9tYW5hZ2UtdmlkZW8nO1xyXG5pbXBvcnQgeyBNYW5hZ2VJbnB1dCB9IGZyb20gJy4vdG9vbHMvbWFuYWdlLWlucHV0JztcclxuaW1wb3J0IHsgQ29jb3NSZXNvdXJjZXMgfSBmcm9tICcuL3Jlc291cmNlcy9jb2Nvcy1yZXNvdXJjZXMnO1xyXG5cclxuY29uc3QgTUFYX0JPRFlfU0laRSA9IDEwMjQgKiAxMDI0OyAvLyAxTUIgcmVxdWVzdCBib2R5IGxpbWl0XHJcblxyXG5leHBvcnQgY2xhc3MgTUNQU2VydmVyIHtcclxuICAgIHByaXZhdGUgc2V0dGluZ3M6IE1DUFNlcnZlclNldHRpbmdzO1xyXG4gICAgcHJpdmF0ZSBodHRwU2VydmVyOiBodHRwLlNlcnZlciB8IG51bGwgPSBudWxsO1xyXG4gICAgcHJpdmF0ZSB0b29sRXhlY3V0b3JzOiBNYXA8c3RyaW5nLCBBY3Rpb25Ub29sRXhlY3V0b3I+ID0gbmV3IE1hcCgpO1xyXG4gICAgcHJpdmF0ZSB0b29sRGVmaW5pdGlvbnM6IFRvb2xEZWZpbml0aW9uW10gPSBbXTtcclxuICAgIHByaXZhdGUgdG9vbHNMaXN0OiBUb29sRGVmaW5pdGlvbltdID0gW107XHJcbiAgICBwcml2YXRlIGVuYWJsZWRUb29sczogc3RyaW5nW10gPSBbXTtcclxuICAgIHByaXZhdGUgcmVzb3VyY2VQcm92aWRlciA9IG5ldyBDb2Nvc1Jlc291cmNlcygpO1xyXG5cclxuICAgIGNvbnN0cnVjdG9yKHNldHRpbmdzOiBNQ1BTZXJ2ZXJTZXR0aW5ncykge1xyXG4gICAgICAgIHRoaXMuc2V0dGluZ3MgPSBzZXR0aW5ncztcclxuICAgICAgICB0aGlzLmluaXRpYWxpemVUb29scygpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgaW5pdGlhbGl6ZVRvb2xzKCk6IHZvaWQge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdbTUNQU2VydmVyXSBJbml0aWFsaXppbmcgdjIgYWN0aW9uLWJhc2VkIHRvb2xzLi4uJyk7XHJcbiAgICAgICAgICAgIGNvbnN0IHRvb2xzOiBBY3Rpb25Ub29sRXhlY3V0b3JbXSA9IFtcclxuICAgICAgICAgICAgICAgIG5ldyBNYW5hZ2VTY2VuZSgpLFxyXG4gICAgICAgICAgICAgICAgbmV3IE1hbmFnZU5vZGUoKSxcclxuICAgICAgICAgICAgICAgIG5ldyBNYW5hZ2VDb21wb25lbnQoKSxcclxuICAgICAgICAgICAgICAgIG5ldyBNYW5hZ2VQcmVmYWIoKSxcclxuICAgICAgICAgICAgICAgIG5ldyBNYW5hZ2VBc3NldCgpLFxyXG4gICAgICAgICAgICAgICAgbmV3IE1hbmFnZVByb2plY3QoKSxcclxuICAgICAgICAgICAgICAgIG5ldyBNYW5hZ2VEZWJ1ZygpLFxyXG4gICAgICAgICAgICAgICAgbmV3IE1hbmFnZVByZWZlcmVuY2VzKCksXHJcbiAgICAgICAgICAgICAgICBuZXcgTWFuYWdlU2VydmVyKCksXHJcbiAgICAgICAgICAgICAgICBuZXcgTWFuYWdlQnJvYWRjYXN0KCksXHJcbiAgICAgICAgICAgICAgICBuZXcgTWFuYWdlU2NlbmVWaWV3KCksXHJcbiAgICAgICAgICAgICAgICBuZXcgTWFuYWdlTm9kZUhpZXJhcmNoeSgpLFxyXG4gICAgICAgICAgICAgICAgbmV3IE1hbmFnZVNjZW5lUXVlcnkoKSxcclxuICAgICAgICAgICAgICAgIG5ldyBNYW5hZ2VVbmRvKCksXHJcbiAgICAgICAgICAgICAgICBuZXcgTWFuYWdlUmVmZXJlbmNlSW1hZ2UoKSxcclxuICAgICAgICAgICAgICAgIG5ldyBNYW5hZ2VWYWxpZGF0aW9uKCksXHJcbiAgICAgICAgICAgICAgICBuZXcgTWFuYWdlU2VsZWN0aW9uKCksXHJcbiAgICAgICAgICAgICAgICBuZXcgTWFuYWdlU2NyaXB0KCksXHJcbiAgICAgICAgICAgICAgICBuZXcgTWFuYWdlTWF0ZXJpYWwoKSxcclxuICAgICAgICAgICAgICAgIG5ldyBNYW5hZ2VBbmltYXRpb24oKSxcclxuICAgICAgICAgICAgICAgIC8vIFBoYXNlIDE6IENvcmUgVG9vbHNcclxuICAgICAgICAgICAgICAgIG5ldyBNYW5hZ2VMaWdodCgpLFxyXG4gICAgICAgICAgICAgICAgbmV3IE1hbmFnZUNhbWVyYSgpLFxyXG4gICAgICAgICAgICAgICAgbmV3IE1hbmFnZVBoeXNpY3MoKSxcclxuICAgICAgICAgICAgICAgIG5ldyBNYW5hZ2VVSSgpLFxyXG4gICAgICAgICAgICAgICAgbmV3IEJhdGNoRXhlY3V0ZSh7IGV4ZWN1dGVUb29sQ2FsbDogdGhpcy5leGVjdXRlVG9vbENhbGwuYmluZCh0aGlzKSB9KSxcclxuICAgICAgICAgICAgICAgIC8vIFBoYXNlIDI6IEdhbWUgVG9vbHNcclxuICAgICAgICAgICAgICAgIG5ldyBNYW5hZ2VBdWRpbygpLFxyXG4gICAgICAgICAgICAgICAgbmV3IE1hbmFnZVBhcnRpY2xlKCksXHJcbiAgICAgICAgICAgICAgICBuZXcgTWFuYWdlVHdlZW4oKSxcclxuICAgICAgICAgICAgICAgIG5ldyBNYW5hZ2VFZGl0b3IoKSxcclxuICAgICAgICAgICAgICAgIC8vIFBoYXNlIDM6IFNwZWNpYWxpemVkIFRvb2xzXHJcbiAgICAgICAgICAgICAgICBuZXcgTWFuYWdlVGlsZW1hcCgpLFxyXG4gICAgICAgICAgICAgICAgbmV3IE1hbmFnZVNwaW5lKCksXHJcbiAgICAgICAgICAgICAgICBuZXcgTWFuYWdlRHJhZ29uQm9uZXMoKSxcclxuICAgICAgICAgICAgICAgIG5ldyBFeGVjdXRlTWVudUl0ZW0oKSxcclxuICAgICAgICAgICAgICAgIG5ldyBNYW5hZ2VUZXJyYWluKCksXHJcbiAgICAgICAgICAgICAgICAvLyBQaGFzZSA0OiBQb2xpc2ggVG9vbHNcclxuICAgICAgICAgICAgICAgIG5ldyBNYW5hZ2VSZW5kZXJQaXBlbGluZSgpLFxyXG4gICAgICAgICAgICAgICAgbmV3IE1hbmFnZVNoYWRlckVmZmVjdCgpLFxyXG4gICAgICAgICAgICAgICAgbmV3IE1hbmFnZU1lc2goKSxcclxuICAgICAgICAgICAgICAgIG5ldyBNYW5hZ2VQcm9maWxlcigpLFxyXG4gICAgICAgICAgICAgICAgbmV3IE1hbmFnZVZpZGVvKCksXHJcbiAgICAgICAgICAgICAgICBuZXcgTWFuYWdlSW5wdXQoKSxcclxuICAgICAgICAgICAgXTtcclxuICAgICAgICAgICAgZm9yIChjb25zdCB0b29sIG9mIHRvb2xzKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnRvb2xFeGVjdXRvcnMuc2V0KHRvb2wubmFtZSwgdG9vbCk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnRvb2xEZWZpbml0aW9ucy5wdXNoKHtcclxuICAgICAgICAgICAgICAgICAgICBuYW1lOiB0b29sLm5hbWUsXHJcbiAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IHRvb2wuZGVzY3JpcHRpb24sXHJcbiAgICAgICAgICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHRvb2wuaW5wdXRTY2hlbWFcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbTUNQU2VydmVyXSAke3RoaXMudG9vbERlZmluaXRpb25zLmxlbmd0aH0gdjIgdG9vbHMgaW5pdGlhbGl6ZWRgKTtcclxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdbTUNQU2VydmVyXSBFcnJvciBpbml0aWFsaXppbmcgdG9vbHM6JywgZXJyb3IpO1xyXG4gICAgICAgICAgICB0aHJvdyBlcnJvcjtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHVibGljIGFzeW5jIHN0YXJ0KCk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgICAgIGlmICh0aGlzLmh0dHBTZXJ2ZXIpIHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coJ1tNQ1BTZXJ2ZXJdIFNlcnZlciBpcyBhbHJlYWR5IHJ1bm5pbmcnKTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coYFtNQ1BTZXJ2ZXJdIFN0YXJ0aW5nIEhUVFAgc2VydmVyIG9uIHBvcnQgJHt0aGlzLnNldHRpbmdzLnBvcnR9Li4uYCk7XHJcbiAgICAgICAgICAgIHRoaXMuaHR0cFNlcnZlciA9IGh0dHAuY3JlYXRlU2VydmVyKHRoaXMuaGFuZGxlSHR0cFJlcXVlc3QuYmluZCh0aGlzKSk7XHJcblxyXG4gICAgICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZTx2b2lkPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmh0dHBTZXJ2ZXIhLmxpc3Rlbih0aGlzLnNldHRpbmdzLnBvcnQsICcxMjcuMC4wLjEnLCAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtNQ1BTZXJ2ZXJdIOKchSBIVFRQIHNlcnZlciBzdGFydGVkIHN1Y2Nlc3NmdWxseSBvbiBodHRwOi8vMTI3LjAuMC4xOiR7dGhpcy5zZXR0aW5ncy5wb3J0fWApO1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbTUNQU2VydmVyXSBIZWFsdGggY2hlY2s6IGh0dHA6Ly8xMjcuMC4wLjE6JHt0aGlzLnNldHRpbmdzLnBvcnR9L2hlYWx0aGApO1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbTUNQU2VydmVyXSBNQ1AgZW5kcG9pbnQ6IGh0dHA6Ly8xMjcuMC4wLjE6JHt0aGlzLnNldHRpbmdzLnBvcnR9L21jcGApO1xyXG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5odHRwU2VydmVyIS5vbignZXJyb3InLCAoZXJyOiBhbnkpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdbTUNQU2VydmVyXSDinYwgRmFpbGVkIHRvIHN0YXJ0IHNlcnZlcjonLCBlcnIpO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChlcnIuY29kZSA9PT0gJ0VBRERSSU5VU0UnKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYFtNQ1BTZXJ2ZXJdIFBvcnQgJHt0aGlzLnNldHRpbmdzLnBvcnR9IGlzIGFscmVhZHkgaW4gdXNlLiBQbGVhc2UgY2hhbmdlIHRoZSBwb3J0IGluIHNldHRpbmdzLmApO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIHRoaXMuc2V0dXBUb29scygpO1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZygnW01DUFNlcnZlcl0g8J+agCBNQ1AgU2VydmVyIGlzIHJlYWR5IGZvciBjb25uZWN0aW9ucycpO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tNQ1BTZXJ2ZXJdIOKdjCBGYWlsZWQgdG8gc3RhcnQgc2VydmVyOicsIGVycm9yKTtcclxuICAgICAgICAgICAgdGhyb3cgZXJyb3I7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgc2V0dXBUb29scygpOiB2b2lkIHtcclxuICAgICAgICB0aGlzLnRvb2xzTGlzdCA9IFtdO1xyXG5cclxuICAgICAgICBpZiAoIXRoaXMuZW5hYmxlZFRvb2xzIHx8IHRoaXMuZW5hYmxlZFRvb2xzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgICAgICAvLyBObyBmaWx0ZXIg4oCUIHJldHVybiBhbGwgdG9vbHNcclxuICAgICAgICAgICAgdGhpcy50b29sc0xpc3QgPSBbLi4udGhpcy50b29sRGVmaW5pdGlvbnNdO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIC8vIEZpbHRlciBieSBlbmFibGVkIHRvb2wgbmFtZXNcclxuICAgICAgICAgICAgY29uc3QgZW5hYmxlZFNldCA9IG5ldyBTZXQodGhpcy5lbmFibGVkVG9vbHMpO1xyXG4gICAgICAgICAgICB0aGlzLnRvb2xzTGlzdCA9IHRoaXMudG9vbERlZmluaXRpb25zLmZpbHRlcih0ID0+IGVuYWJsZWRTZXQuaGFzKHQubmFtZSkpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc29sZS5sb2coYFtNQ1BTZXJ2ZXJdIFNldHVwIHRvb2xzOiAke3RoaXMudG9vbHNMaXN0Lmxlbmd0aH0gdG9vbHMgYXZhaWxhYmxlYCk7XHJcbiAgICB9XHJcblxyXG4gICAgcHVibGljIGdldEZpbHRlcmVkVG9vbHMoZW5hYmxlZFRvb2xzOiBzdHJpbmdbXSk6IFRvb2xEZWZpbml0aW9uW10ge1xyXG4gICAgICAgIGlmICghZW5hYmxlZFRvb2xzIHx8IGVuYWJsZWRUb29scy5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMudG9vbHNMaXN0O1xyXG4gICAgICAgIH1cclxuICAgICAgICBjb25zdCBlbmFibGVkU2V0ID0gbmV3IFNldChlbmFibGVkVG9vbHMpO1xyXG4gICAgICAgIHJldHVybiB0aGlzLnRvb2xzTGlzdC5maWx0ZXIodG9vbCA9PiBlbmFibGVkU2V0Lmhhcyh0b29sLm5hbWUpKTtcclxuICAgIH1cclxuXHJcbiAgICBwdWJsaWMgYXN5bmMgZXhlY3V0ZVRvb2xDYWxsKHRvb2xOYW1lOiBzdHJpbmcsIGFyZ3M6IGFueSk6IFByb21pc2U8YW55PiB7XHJcbiAgICAgICAgY29uc3QgZXhlY3V0b3IgPSB0aGlzLnRvb2xFeGVjdXRvcnMuZ2V0KHRvb2xOYW1lKTtcclxuICAgICAgICBpZiAoIWV4ZWN1dG9yKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVG9vbCAnJHt0b29sTmFtZX0nIG5vdCBmb3VuZC4gQXZhaWxhYmxlOiAke0FycmF5LmZyb20odGhpcy50b29sRXhlY3V0b3JzLmtleXMoKSkuam9pbignLCAnKX1gKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgY29uc3QgeyBhY3Rpb24sIC4uLnJlc3RBcmdzIH0gPSBhcmdzO1xyXG4gICAgICAgIGlmICghYWN0aW9uKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcclxuICAgICAgICAgICAgICAgIGBNaXNzaW5nIHJlcXVpcmVkICdhY3Rpb24nIHBhcmFtZXRlciBmb3IgdG9vbCAnJHt0b29sTmFtZX0nLiBgICtcclxuICAgICAgICAgICAgICAgIGBBdmFpbGFibGUgYWN0aW9uczogJHtleGVjdXRvci5hY3Rpb25zLmpvaW4oJywgJyl9YFxyXG4gICAgICAgICAgICApO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gYXdhaXQgZXhlY3V0b3IuZXhlY3V0ZShhY3Rpb24sIHJlc3RBcmdzKTtcclxuICAgIH1cclxuXHJcbiAgICBwdWJsaWMgZ2V0QXZhaWxhYmxlVG9vbHMoKTogVG9vbERlZmluaXRpb25bXSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMudG9vbHNMaXN0O1xyXG4gICAgfVxyXG5cclxuICAgIHB1YmxpYyB1cGRhdGVFbmFibGVkVG9vbHMoZW5hYmxlZFRvb2xzOiBzdHJpbmdbXSk6IHZvaWQge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKGBbTUNQU2VydmVyXSBVcGRhdGluZyBlbmFibGVkIHRvb2xzOiAke2VuYWJsZWRUb29scy5sZW5ndGh9IHRvb2xzYCk7XHJcbiAgICAgICAgdGhpcy5lbmFibGVkVG9vbHMgPSBlbmFibGVkVG9vbHM7XHJcbiAgICAgICAgdGhpcy5zZXR1cFRvb2xzKCk7XHJcbiAgICB9XHJcblxyXG4gICAgcHVibGljIGdldFNldHRpbmdzKCk6IE1DUFNlcnZlclNldHRpbmdzIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5zZXR0aW5ncztcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGhhbmRsZUh0dHBSZXF1ZXN0KHJlcTogaHR0cC5JbmNvbWluZ01lc3NhZ2UsIHJlczogaHR0cC5TZXJ2ZXJSZXNwb25zZSk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgICAgIGNvbnN0IHBhcnNlZFVybCA9IHVybC5wYXJzZShyZXEudXJsIHx8ICcnLCB0cnVlKTtcclxuICAgICAgICBjb25zdCBwYXRobmFtZSA9IHBhcnNlZFVybC5wYXRobmFtZTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBTZXQgQ09SUyBoZWFkZXJzIOKAlCBlbmZvcmNlIGFsbG93ZWRPcmlnaW5zIGlmIGNvbmZpZ3VyZWRcclxuICAgICAgICBjb25zdCBvcmlnaW4gPSByZXEuaGVhZGVycy5vcmlnaW47XHJcbiAgICAgICAgY29uc3QgYWxsb3dlZE9yaWdpbnMgPSB0aGlzLnNldHRpbmdzLmFsbG93ZWRPcmlnaW5zO1xyXG4gICAgICAgIGlmICghYWxsb3dlZE9yaWdpbnMgfHwgYWxsb3dlZE9yaWdpbnMubGVuZ3RoID09PSAwIHx8IGFsbG93ZWRPcmlnaW5zLmluY2x1ZGVzKCcqJykpIHtcclxuICAgICAgICAgICAgcmVzLnNldEhlYWRlcignQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJywgJyonKTtcclxuICAgICAgICB9IGVsc2UgaWYgKG9yaWdpbiAmJiBhbGxvd2VkT3JpZ2lucy5pbmNsdWRlcyhvcmlnaW4pKSB7XHJcbiAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ0FjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbicsIG9yaWdpbik7XHJcbiAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ1ZhcnknLCAnT3JpZ2luJyk7XHJcbiAgICAgICAgfSBlbHNlIGlmIChvcmlnaW4gJiYgYWxsb3dlZE9yaWdpbnMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgICAvLyBPcmlnaW4gbm90IGluIGFsbG93ZWRPcmlnaW5zIOKAlCByZWplY3Qgd2l0aCA0MDNcclxuICAgICAgICAgICAgcmVzLndyaXRlSGVhZCg0MDMsIHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9KTtcclxuICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiAnT3JpZ2luIG5vdCBhbGxvd2VkJyB9KSk7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgLy8gTm8gb3JpZ2luIGhlYWRlciAobm9uLWJyb3dzZXIgY2xpZW50cyBsaWtlIGN1cmwsIE1DUCBjbGllbnRzKSDigJQgYWxsb3cgdGhyb3VnaFxyXG4gICAgICAgIHJlcy5zZXRIZWFkZXIoJ0FjY2Vzcy1Db250cm9sLUFsbG93LU1ldGhvZHMnLCAnR0VULCBQT1NULCBPUFRJT05TJyk7XHJcbiAgICAgICAgcmVzLnNldEhlYWRlcignQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVycycsICdDb250ZW50LVR5cGUsIEF1dGhvcml6YXRpb24nKTtcclxuICAgICAgICByZXMuc2V0SGVhZGVyKCdDb250ZW50LVR5cGUnLCAnYXBwbGljYXRpb24vanNvbicpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChyZXEubWV0aG9kID09PSAnT1BUSU9OUycpIHtcclxuICAgICAgICAgICAgaWYgKCFyZXMud3JpdGFibGVFbmRlZCkgeyByZXMud3JpdGVIZWFkKDIwMCk7IHJlcy5lbmQoKTsgfVxyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBpZiAocGF0aG5hbWUgPT09ICcvbWNwJyAmJiByZXEubWV0aG9kID09PSAnUE9TVCcpIHtcclxuICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuaGFuZGxlTUNQUmVxdWVzdChyZXEsIHJlcyk7XHJcbiAgICAgICAgICAgIH0gZWxzZSBpZiAocGF0aG5hbWUgPT09ICcvaGVhbHRoJyAmJiByZXEubWV0aG9kID09PSAnR0VUJykge1xyXG4gICAgICAgICAgICAgICAgaWYgKCFyZXMud3JpdGFibGVFbmRlZCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlcy53cml0ZUhlYWQoMjAwKTtcclxuICAgICAgICAgICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3RhdHVzOiAnb2snLCB0b29sczogdGhpcy50b29sc0xpc3QubGVuZ3RoIH0pKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSBlbHNlIGlmIChwYXRobmFtZT8uc3RhcnRzV2l0aCgnL2FwaS8nKSAmJiByZXEubWV0aG9kID09PSAnUE9TVCcpIHtcclxuICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuaGFuZGxlU2ltcGxlQVBJUmVxdWVzdChyZXEsIHJlcywgcGF0aG5hbWUpO1xyXG4gICAgICAgICAgICB9IGVsc2UgaWYgKHBhdGhuYW1lID09PSAnL2FwaS90b29scycgJiYgcmVxLm1ldGhvZCA9PT0gJ0dFVCcpIHtcclxuICAgICAgICAgICAgICAgIGlmICghcmVzLndyaXRhYmxlRW5kZWQpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXMud3JpdGVIZWFkKDIwMCk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHRvb2xzOiB0aGlzLmdldFNpbXBsaWZpZWRUb29sc0xpc3QoKSB9KSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoIXJlcy53cml0YWJsZUVuZGVkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzLndyaXRlSGVhZCg0MDQpO1xyXG4gICAgICAgICAgICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogJ05vdCBmb3VuZCcgfSkpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICAgICAgY29uc29sZS5lcnJvcignSFRUUCByZXF1ZXN0IGVycm9yOicsIGVycm9yKTtcclxuICAgICAgICAgICAgaWYgKCFyZXMud3JpdGFibGVFbmRlZCkge1xyXG4gICAgICAgICAgICAgICAgcmVzLndyaXRlSGVhZCg1MDApO1xyXG4gICAgICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiAnSW50ZXJuYWwgc2VydmVyIGVycm9yJyB9KSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHByaXZhdGUgYXN5bmMgaGFuZGxlTUNQUmVxdWVzdChyZXE6IGh0dHAuSW5jb21pbmdNZXNzYWdlLCByZXM6IGh0dHAuU2VydmVyUmVzcG9uc2UpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgICAgICBsZXQgYm9keSA9ICcnO1xyXG4gICAgICAgIGxldCBib2R5U2l6ZSA9IDA7XHJcblxyXG4gICAgICAgIHJlcS5vbignZGF0YScsIChjaHVuazogQnVmZmVyKSA9PiB7XHJcbiAgICAgICAgICAgIGJvZHlTaXplICs9IGNodW5rLmxlbmd0aDtcclxuICAgICAgICAgICAgaWYgKGJvZHlTaXplID4gTUFYX0JPRFlfU0laRSkge1xyXG4gICAgICAgICAgICAgICAgcmVxLmRlc3Ryb3koKTtcclxuICAgICAgICAgICAgICAgIGlmICghcmVzLndyaXRhYmxlRW5kZWQpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXMud3JpdGVIZWFkKDQxMyk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiAnUmVxdWVzdCBib2R5IHRvbyBsYXJnZScgfSkpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGJvZHkgKz0gY2h1bmsudG9TdHJpbmcoKTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgcmVxLm9uKCdlbmQnLCBhc3luYyAoKSA9PiB7XHJcbiAgICAgICAgICAgIGlmIChyZXMud3JpdGFibGVFbmRlZCkgcmV0dXJuO1xyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgbWVzc2FnZSA9IEpTT04ucGFyc2UoYm9keSk7XHJcblxyXG4gICAgICAgICAgICAgICAgLy8gSlNPTi1SUEMgMi4wIHZhbGlkYXRpb25cclxuICAgICAgICAgICAgICAgIGlmICghbWVzc2FnZS5qc29ucnBjIHx8IG1lc3NhZ2UuanNvbnJwYyAhPT0gJzIuMCcpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXMud3JpdGVIZWFkKDIwMCk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGpzb25ycGM6ICcyLjAnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZDogbWVzc2FnZS5pZCA/PyBudWxsLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBlcnJvcjogeyBjb2RlOiAtMzI2MDAsIG1lc3NhZ2U6ICdJbnZhbGlkIFJlcXVlc3Q6IG1pc3NpbmcganNvbnJwYyBmaWVsZCcgfVxyXG4gICAgICAgICAgICAgICAgICAgIH0pKTtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCB0aGlzLmhhbmRsZU1lc3NhZ2UobWVzc2FnZSk7XHJcbiAgICAgICAgICAgICAgICBpZiAoIXJlcy53cml0YWJsZUVuZGVkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzLndyaXRlSGVhZCgyMDApO1xyXG4gICAgICAgICAgICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkocmVzcG9uc2UpKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgaGFuZGxpbmcgTUNQIHJlcXVlc3Q6JywgZXJyb3IpO1xyXG4gICAgICAgICAgICAgICAgaWYgKCFyZXMud3JpdGFibGVFbmRlZCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlcy53cml0ZUhlYWQoNDAwKTtcclxuICAgICAgICAgICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHtcclxuICAgICAgICAgICAgICAgICAgICAgICAganNvbnJwYzogJzIuMCcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlkOiBudWxsLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBlcnJvcjogeyBjb2RlOiAtMzI3MDAsIG1lc3NhZ2U6IGBQYXJzZSBlcnJvcjogJHtlcnJvci5tZXNzYWdlfWAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH0pKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgaGFuZGxlTWVzc2FnZShtZXNzYWdlOiBhbnkpOiBQcm9taXNlPGFueT4ge1xyXG4gICAgICAgIGNvbnN0IHsgaWQsIG1ldGhvZCwgcGFyYW1zIH0gPSBtZXNzYWdlO1xyXG4gICAgICAgIGlmICh0aGlzLnNldHRpbmdzLmVuYWJsZURlYnVnTG9nKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbTUNQU2VydmVyXSBbZGVidWddIG1ldGhvZD0ke21ldGhvZH0gaWQ9JHtpZH1gKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGxldCByZXN1bHQ6IGFueTtcclxuXHJcbiAgICAgICAgICAgIHN3aXRjaCAobWV0aG9kKSB7XHJcbiAgICAgICAgICAgICAgICBjYXNlICd0b29scy9saXN0JzpcclxuICAgICAgICAgICAgICAgICAgICByZXN1bHQgPSB7IHRvb2xzOiB0aGlzLmdldEF2YWlsYWJsZVRvb2xzKCkgfTtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIGNhc2UgJ3Rvb2xzL2NhbGwnOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgeyBuYW1lLCBhcmd1bWVudHM6IGNhbGxBcmdzIH0gPSBwYXJhbXM7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdG9vbFJlc3VsdCA9IGF3YWl0IHRoaXMuZXhlY3V0ZVRvb2xDYWxsKG5hbWUsIGNhbGxBcmdzKTtcclxuICAgICAgICAgICAgICAgICAgICByZXN1bHQgPSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRlbnQ6IFt7IHR5cGU6ICd0ZXh0JywgdGV4dDogSlNPTi5zdHJpbmdpZnkodG9vbFJlc3VsdCkgfV0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlzRXJyb3I6IHRvb2xSZXN1bHQuaXNFcnJvciB8fCBmYWxzZVxyXG4gICAgICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBjYXNlICdyZXNvdXJjZXMvbGlzdCc6XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0ID0geyByZXNvdXJjZXM6IHRoaXMucmVzb3VyY2VQcm92aWRlci5yZXNvdXJjZXMgfTtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIGNhc2UgJ3Jlc291cmNlcy9yZWFkJzoge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHsgdXJpIH0gPSBwYXJhbXM7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY29udGVudCA9IGF3YWl0IHRoaXMucmVzb3VyY2VQcm92aWRlci5yZWFkKHVyaSk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0ID0geyBjb250ZW50czogW2NvbnRlbnRdIH07XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBjYXNlICdpbml0aWFsaXplJzpcclxuICAgICAgICAgICAgICAgICAgICByZXN1bHQgPSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb3RvY29sVmVyc2lvbjogJzIwMjQtMTEtMDUnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjYXBhYmlsaXRpZXM6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRvb2xzOiB7fSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc291cmNlczoge31cclxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgc2VydmVySW5mbzoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmVyc2lvbjogJzIuMC4wJ1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAganNvbnJwYzogJzIuMCcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlkLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBlcnJvcjogeyBjb2RlOiAtMzI2MDEsIG1lc3NhZ2U6IGBNZXRob2Qgbm90IGZvdW5kOiAke21ldGhvZH1gIH1cclxuICAgICAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAganNvbnJwYzogJzIuMCcsXHJcbiAgICAgICAgICAgICAgICBpZCxcclxuICAgICAgICAgICAgICAgIHJlc3VsdFxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIGpzb25ycGM6ICcyLjAnLFxyXG4gICAgICAgICAgICAgICAgaWQsXHJcbiAgICAgICAgICAgICAgICBlcnJvcjoge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvZGU6IC0zMjYwMyxcclxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBlcnJvci5tZXNzYWdlXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHB1YmxpYyBzdG9wKCk6IHZvaWQge1xyXG4gICAgICAgIGlmICh0aGlzLmh0dHBTZXJ2ZXIpIHtcclxuICAgICAgICAgICAgdGhpcy5odHRwU2VydmVyLmNsb3NlKCk7XHJcbiAgICAgICAgICAgIHRoaXMuaHR0cFNlcnZlciA9IG51bGw7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdbTUNQU2VydmVyXSBIVFRQIHNlcnZlciBzdG9wcGVkJyk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHB1YmxpYyBnZXRTdGF0dXMoKTogU2VydmVyU3RhdHVzIHtcclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICBydW5uaW5nOiAhIXRoaXMuaHR0cFNlcnZlcixcclxuICAgICAgICAgICAgcG9ydDogdGhpcy5zZXR0aW5ncy5wb3J0LFxyXG4gICAgICAgICAgICBjbGllbnRzOiAwIC8vIEhUVFAgaXMgc3RhdGVsZXNzLCBubyBwZXJzaXN0ZW50IGNsaWVudHNcclxuICAgICAgICB9O1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgaGFuZGxlU2ltcGxlQVBJUmVxdWVzdChyZXE6IGh0dHAuSW5jb21pbmdNZXNzYWdlLCByZXM6IGh0dHAuU2VydmVyUmVzcG9uc2UsIHBhdGhuYW1lOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgICAgICBsZXQgYm9keSA9ICcnO1xyXG4gICAgICAgIGxldCBib2R5U2l6ZSA9IDA7XHJcblxyXG4gICAgICAgIHJlcS5vbignZGF0YScsIChjaHVuazogQnVmZmVyKSA9PiB7XHJcbiAgICAgICAgICAgIGJvZHlTaXplICs9IGNodW5rLmxlbmd0aDtcclxuICAgICAgICAgICAgaWYgKGJvZHlTaXplID4gTUFYX0JPRFlfU0laRSkge1xyXG4gICAgICAgICAgICAgICAgcmVxLmRlc3Ryb3koKTtcclxuICAgICAgICAgICAgICAgIGlmICghcmVzLndyaXRhYmxlRW5kZWQpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXMud3JpdGVIZWFkKDQxMyk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiAnUmVxdWVzdCBib2R5IHRvbyBsYXJnZScgfSkpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGJvZHkgKz0gY2h1bmsudG9TdHJpbmcoKTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgcmVxLm9uKCdlbmQnLCBhc3luYyAoKSA9PiB7XHJcbiAgICAgICAgICAgIGlmIChyZXMud3JpdGFibGVFbmRlZCkgcmV0dXJuO1xyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgLy8gRXh0cmFjdCB0b29sIG5hbWUgZnJvbSBwYXRoIGxpa2UgL2FwaS9tYW5hZ2Vfbm9kZVxyXG4gICAgICAgICAgICAgICAgY29uc3QgcGF0aFBhcnRzID0gcGF0aG5hbWUuc3BsaXQoJy8nKS5maWx0ZXIocCA9PiBwKTtcclxuICAgICAgICAgICAgICAgIGlmIChwYXRoUGFydHMubGVuZ3RoIDwgMikge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlcy53cml0ZUhlYWQoNDAwKTtcclxuICAgICAgICAgICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6ICdJbnZhbGlkIEFQSSBwYXRoLiBVc2UgL2FwaS97dG9vbF9uYW1lfScgfSkpO1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICBjb25zdCBmdWxsVG9vbE5hbWUgPSBwYXRoUGFydHMuc2xpY2UoMSkuam9pbignXycpO1xyXG5cclxuICAgICAgICAgICAgICAgIGxldCBwYXJhbXM6IGFueTtcclxuICAgICAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcGFyYW1zID0gYm9keSA/IEpTT04ucGFyc2UoYm9keSkgOiB7fTtcclxuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKHBhcnNlRXJyb3I6IGFueSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlcy53cml0ZUhlYWQoNDAwKTtcclxuICAgICAgICAgICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZXJyb3I6ICdJbnZhbGlkIEpTT04gaW4gcmVxdWVzdCBib2R5JyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgZGV0YWlsczogcGFyc2VFcnJvci5tZXNzYWdlXHJcbiAgICAgICAgICAgICAgICAgICAgfSkpO1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmV4ZWN1dGVUb29sQ2FsbChmdWxsVG9vbE5hbWUsIHBhcmFtcyk7XHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKCFyZXMud3JpdGFibGVFbmRlZCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlcy53cml0ZUhlYWQoMjAwKTtcclxuICAgICAgICAgICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogdHJ1ZSwgdG9vbDogZnVsbFRvb2xOYW1lLCByZXN1bHQgfSkpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdTaW1wbGUgQVBJIGVycm9yOicsIGVycm9yKTtcclxuICAgICAgICAgICAgICAgIGlmICghcmVzLndyaXRhYmxlRW5kZWQpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXMud3JpdGVIZWFkKDUwMCk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSwgdG9vbDogcGF0aG5hbWUgfSkpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBnZXRTaW1wbGlmaWVkVG9vbHNMaXN0KCk6IGFueVtdIHtcclxuICAgICAgICByZXR1cm4gdGhpcy50b29sc0xpc3QubWFwKHRvb2wgPT4ge1xyXG4gICAgICAgICAgICBjb25zdCBleGVjdXRvciA9IHRoaXMudG9vbEV4ZWN1dG9ycy5nZXQodG9vbC5uYW1lKTtcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIG5hbWU6IHRvb2wubmFtZSxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiB0b29sLmRlc2NyaXB0aW9uLFxyXG4gICAgICAgICAgICAgICAgYWN0aW9uczogZXhlY3V0b3IgPyBleGVjdXRvci5hY3Rpb25zIDogW10sXHJcbiAgICAgICAgICAgICAgICBhcGlQYXRoOiBgL2FwaS8ke3Rvb2wubmFtZX1gLFxyXG4gICAgICAgICAgICAgICAgY3VybEV4YW1wbGU6IHRoaXMuZ2VuZXJhdGVDdXJsRXhhbXBsZSh0b29sLm5hbWUsIHRvb2wuaW5wdXRTY2hlbWEpXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBnZW5lcmF0ZUN1cmxFeGFtcGxlKHRvb2xOYW1lOiBzdHJpbmcsIHNjaGVtYTogYW55KTogc3RyaW5nIHtcclxuICAgICAgICBjb25zdCBzYW1wbGVQYXJhbXMgPSB0aGlzLmdlbmVyYXRlU2FtcGxlUGFyYW1zKHNjaGVtYSk7XHJcbiAgICAgICAgY29uc3QganNvblN0cmluZyA9IEpTT04uc3RyaW5naWZ5KHNhbXBsZVBhcmFtcywgbnVsbCwgMik7XHJcblxyXG4gICAgICAgIHJldHVybiBgY3VybCAtWCBQT1NUIGh0dHA6Ly8xMjcuMC4wLjE6JHt0aGlzLnNldHRpbmdzLnBvcnR9L2FwaS8ke3Rvb2xOYW1lfSBcXFxcXHJcbiAgLUggXCJDb250ZW50LVR5cGU6IGFwcGxpY2F0aW9uL2pzb25cIiBcXFxcXHJcbiAgLWQgJyR7anNvblN0cmluZ30nYDtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGdlbmVyYXRlU2FtcGxlUGFyYW1zKHNjaGVtYTogYW55KTogYW55IHtcclxuICAgICAgICBpZiAoIXNjaGVtYSB8fCAhc2NoZW1hLnByb3BlcnRpZXMpIHJldHVybiB7fTtcclxuICAgICAgICBcclxuICAgICAgICBjb25zdCBzYW1wbGU6IGFueSA9IHt9O1xyXG4gICAgICAgIGZvciAoY29uc3QgW2tleSwgcHJvcF0gb2YgT2JqZWN0LmVudHJpZXMoc2NoZW1hLnByb3BlcnRpZXMgYXMgYW55KSkge1xyXG4gICAgICAgICAgICBjb25zdCBwcm9wU2NoZW1hID0gcHJvcCBhcyBhbnk7XHJcbiAgICAgICAgICAgIHN3aXRjaCAocHJvcFNjaGVtYS50eXBlKSB7XHJcbiAgICAgICAgICAgICAgICBjYXNlICdzdHJpbmcnOlxyXG4gICAgICAgICAgICAgICAgICAgIHNhbXBsZVtrZXldID0gcHJvcFNjaGVtYS5kZWZhdWx0IHx8ICdleGFtcGxlX3N0cmluZyc7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICBjYXNlICdudW1iZXInOlxyXG4gICAgICAgICAgICAgICAgICAgIHNhbXBsZVtrZXldID0gcHJvcFNjaGVtYS5kZWZhdWx0IHx8IDQyO1xyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgY2FzZSAnYm9vbGVhbic6XHJcbiAgICAgICAgICAgICAgICAgICAgc2FtcGxlW2tleV0gPSBwcm9wU2NoZW1hLmRlZmF1bHQgfHwgdHJ1ZTtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIGNhc2UgJ29iamVjdCc6XHJcbiAgICAgICAgICAgICAgICAgICAgc2FtcGxlW2tleV0gPSBwcm9wU2NoZW1hLmRlZmF1bHQgfHwgeyB4OiAwLCB5OiAwLCB6OiAwIH07XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgICAgIHNhbXBsZVtrZXldID0gJ2V4YW1wbGVfdmFsdWUnO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBzYW1wbGU7XHJcbiAgICB9XHJcblxyXG4gICAgcHVibGljIHVwZGF0ZVNldHRpbmdzKHNldHRpbmdzOiBNQ1BTZXJ2ZXJTZXR0aW5ncyk6IHZvaWQge1xyXG4gICAgICAgIHRoaXMuc2V0dGluZ3MgPSBzZXR0aW5ncztcclxuICAgICAgICBpZiAodGhpcy5odHRwU2VydmVyKSB7XHJcbiAgICAgICAgICAgIHRoaXMuc3RvcCgpO1xyXG4gICAgICAgICAgICB0aGlzLnN0YXJ0KCkuY2F0Y2goZXJyID0+IGNvbnNvbGUuZXJyb3IoJ1tNQ1BTZXJ2ZXJdIEZhaWxlZCB0byByZXN0YXJ0IGFmdGVyIHNldHRpbmdzIHVwZGF0ZTonLCBlcnIpKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn1cclxuXHJcbi8vIEhUVFAgdHJhbnNwb3J0IGRvZXNuJ3QgbmVlZCBwZXJzaXN0ZW50IGNvbm5lY3Rpb25zXHJcbi8vIE1DUCBvdmVyIEhUVFAgdXNlcyByZXF1ZXN0LXJlc3BvbnNlIHBhdHRlcm4iXX0=