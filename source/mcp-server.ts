import * as http from 'http';
import * as url from 'url';
import { MCPServerSettings, ServerStatus, ToolDefinition, ActionToolExecutor } from './types';
import { ManageScene } from './tools/manage-scene';
import { ManageNode } from './tools/manage-node';
import { ManageComponent } from './tools/manage-component';
import { ManagePrefab } from './tools/manage-prefab';
import { ManageAsset } from './tools/manage-asset';
import { ManageProject } from './tools/manage-project';
import { ManageDebug } from './tools/manage-debug';
import { ManagePreferences } from './tools/manage-preferences';
import { ManageServer } from './tools/manage-server';
import { ManageBroadcast } from './tools/manage-broadcast';
import { ManageSceneView } from './tools/manage-scene-view';
import { ManageNodeHierarchy } from './tools/manage-node-hierarchy';
import { ManageSceneQuery } from './tools/manage-scene-query';
import { ManageUndo } from './tools/manage-undo';
import { ManageReferenceImage } from './tools/manage-reference-image';
import { ManageValidation } from './tools/manage-validation';
import { ManageSelection } from './tools/manage-selection';
import { ManageScript } from './tools/manage-script';
import { ManageMaterial } from './tools/manage-material';
import { ManageAnimation } from './tools/manage-animation';
import { CocosResources } from './resources/cocos-resources';

const MAX_BODY_SIZE = 1024 * 1024; // 1MB request body limit

export class MCPServer {
    private settings: MCPServerSettings;
    private httpServer: http.Server | null = null;
    private toolExecutors: Map<string, ActionToolExecutor> = new Map();
    private toolDefinitions: ToolDefinition[] = [];
    private toolsList: ToolDefinition[] = [];
    private enabledTools: string[] = [];
    private resourceProvider = new CocosResources();

    constructor(settings: MCPServerSettings) {
        this.settings = settings;
        this.initializeTools();
    }

    private initializeTools(): void {
        try {
            console.log('[MCPServer] Initializing v2 action-based tools...');
            const tools: ActionToolExecutor[] = [
                new ManageScene(),
                new ManageNode(),
                new ManageComponent(),
                new ManagePrefab(),
                new ManageAsset(),
                new ManageProject(),
                new ManageDebug(),
                new ManagePreferences(),
                new ManageServer(),
                new ManageBroadcast(),
                new ManageSceneView(),
                new ManageNodeHierarchy(),
                new ManageSceneQuery(),
                new ManageUndo(),
                new ManageReferenceImage(),
                new ManageValidation(),
                new ManageSelection(),
                new ManageScript(),
                new ManageMaterial(),
                new ManageAnimation(),
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
        } catch (error) {
            console.error('[MCPServer] Error initializing tools:', error);
            throw error;
        }
    }

    public async start(): Promise<void> {
        if (this.httpServer) {
            console.log('[MCPServer] Server is already running');
            return;
        }

        try {
            console.log(`[MCPServer] Starting HTTP server on port ${this.settings.port}...`);
            this.httpServer = http.createServer(this.handleHttpRequest.bind(this));

            await new Promise<void>((resolve, reject) => {
                this.httpServer!.listen(this.settings.port, '127.0.0.1', () => {
                    console.log(`[MCPServer] ✅ HTTP server started successfully on http://127.0.0.1:${this.settings.port}`);
                    console.log(`[MCPServer] Health check: http://127.0.0.1:${this.settings.port}/health`);
                    console.log(`[MCPServer] MCP endpoint: http://127.0.0.1:${this.settings.port}/mcp`);
                    resolve();
                });
                this.httpServer!.on('error', (err: any) => {
                    console.error('[MCPServer] ❌ Failed to start server:', err);
                    if (err.code === 'EADDRINUSE') {
                        console.error(`[MCPServer] Port ${this.settings.port} is already in use. Please change the port in settings.`);
                    }
                    reject(err);
                });
            });

            this.setupTools();
            console.log('[MCPServer] 🚀 MCP Server is ready for connections');
        } catch (error) {
            console.error('[MCPServer] ❌ Failed to start server:', error);
            throw error;
        }
    }

    private setupTools(): void {
        this.toolsList = [];

        if (!this.enabledTools || this.enabledTools.length === 0) {
            // No filter — return all tools
            this.toolsList = [...this.toolDefinitions];
        } else {
            // Filter by enabled tool names
            const enabledSet = new Set(this.enabledTools);
            this.toolsList = this.toolDefinitions.filter(t => enabledSet.has(t.name));
        }

        console.log(`[MCPServer] Setup tools: ${this.toolsList.length} tools available`);
    }

    public getFilteredTools(enabledTools: string[]): ToolDefinition[] {
        if (!enabledTools || enabledTools.length === 0) {
            return this.toolsList;
        }
        const enabledSet = new Set(enabledTools);
        return this.toolsList.filter(tool => enabledSet.has(tool.name));
    }

    public async executeToolCall(toolName: string, args: any): Promise<any> {
        const executor = this.toolExecutors.get(toolName);
        if (!executor) {
            throw new Error(`Tool '${toolName}' not found. Available: ${Array.from(this.toolExecutors.keys()).join(', ')}`);
        }
        const { action, ...restArgs } = args;
        if (!action) {
            throw new Error(
                `Missing required 'action' parameter for tool '${toolName}'. ` +
                `Available actions: ${executor.actions.join(', ')}`
            );
        }
        return await executor.execute(action, restArgs);
    }

    public getAvailableTools(): ToolDefinition[] {
        return this.toolsList;
    }

    public updateEnabledTools(enabledTools: string[]): void {
        console.log(`[MCPServer] Updating enabled tools: ${enabledTools.length} tools`);
        this.enabledTools = enabledTools;
        this.setupTools();
    }

    public getSettings(): MCPServerSettings {
        return this.settings;
    }

    private async handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        const parsedUrl = url.parse(req.url || '', true);
        const pathname = parsedUrl.pathname;
        
        // Set CORS headers — enforce allowedOrigins if configured
        const origin = req.headers.origin;
        const allowedOrigins = this.settings.allowedOrigins;
        if (!allowedOrigins || allowedOrigins.length === 0 || allowedOrigins.includes('*')) {
            res.setHeader('Access-Control-Allow-Origin', '*');
        } else if (origin && allowedOrigins.includes(origin)) {
            res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Vary', 'Origin');
        } else if (origin && allowedOrigins.length > 0) {
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
            if (!res.writableEnded) { res.writeHead(200); res.end(); }
            return;
        }

        try {
            if (pathname === '/mcp' && req.method === 'POST') {
                await this.handleMCPRequest(req, res);
            } else if (pathname === '/health' && req.method === 'GET') {
                if (!res.writableEnded) {
                    res.writeHead(200);
                    res.end(JSON.stringify({ status: 'ok', tools: this.toolsList.length }));
                }
            } else if (pathname?.startsWith('/api/') && req.method === 'POST') {
                await this.handleSimpleAPIRequest(req, res, pathname);
            } else if (pathname === '/api/tools' && req.method === 'GET') {
                if (!res.writableEnded) {
                    res.writeHead(200);
                    res.end(JSON.stringify({ tools: this.getSimplifiedToolsList() }));
                }
            } else {
                if (!res.writableEnded) {
                    res.writeHead(404);
                    res.end(JSON.stringify({ error: 'Not found' }));
                }
            }
        } catch (error) {
            console.error('HTTP request error:', error);
            if (!res.writableEnded) {
                res.writeHead(500);
                res.end(JSON.stringify({ error: 'Internal server error' }));
            }
        }
    }
    
    private async handleMCPRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        let body = '';
        let bodySize = 0;

        req.on('data', (chunk: Buffer) => {
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
            if (res.writableEnded) return;
            try {
                const message = JSON.parse(body);

                // JSON-RPC 2.0 validation
                if (!message.jsonrpc || message.jsonrpc !== '2.0') {
                    res.writeHead(200);
                    res.end(JSON.stringify({
                        jsonrpc: '2.0',
                        id: message.id ?? null,
                        error: { code: -32600, message: 'Invalid Request: missing jsonrpc field' }
                    }));
                    return;
                }

                const response = await this.handleMessage(message);
                if (!res.writableEnded) {
                    res.writeHead(200);
                    res.end(JSON.stringify(response));
                }
            } catch (error: any) {
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

    private async handleMessage(message: any): Promise<any> {
        const { id, method, params } = message;
        if (this.settings.enableDebugLog) {
            console.log(`[MCPServer] [debug] method=${method} id=${id}`);
        }

        try {
            let result: any;

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
        } catch (error: any) {
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

    public stop(): void {
        if (this.httpServer) {
            this.httpServer.close();
            this.httpServer = null;
            console.log('[MCPServer] HTTP server stopped');
        }
    }

    public getStatus(): ServerStatus {
        return {
            running: !!this.httpServer,
            port: this.settings.port,
            clients: 0 // HTTP is stateless, no persistent clients
        };
    }

    private async handleSimpleAPIRequest(req: http.IncomingMessage, res: http.ServerResponse, pathname: string): Promise<void> {
        let body = '';
        let bodySize = 0;

        req.on('data', (chunk: Buffer) => {
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
            if (res.writableEnded) return;
            try {
                // Extract tool name from path like /api/manage_node
                const pathParts = pathname.split('/').filter(p => p);
                if (pathParts.length < 2) {
                    res.writeHead(400);
                    res.end(JSON.stringify({ error: 'Invalid API path. Use /api/{tool_name}' }));
                    return;
                }

                const fullToolName = pathParts.slice(1).join('_');

                let params: any;
                try {
                    params = body ? JSON.parse(body) : {};
                } catch (parseError: any) {
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
            } catch (error: any) {
                console.error('Simple API error:', error);
                if (!res.writableEnded) {
                    res.writeHead(500);
                    res.end(JSON.stringify({ success: false, error: error.message, tool: pathname }));
                }
            }
        });
    }

    private getSimplifiedToolsList(): any[] {
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

    private generateCurlExample(toolName: string, schema: any): string {
        const sampleParams = this.generateSampleParams(schema);
        const jsonString = JSON.stringify(sampleParams, null, 2);

        return `curl -X POST http://127.0.0.1:${this.settings.port}/api/${toolName} \\
  -H "Content-Type: application/json" \\
  -d '${jsonString}'`;
    }

    private generateSampleParams(schema: any): any {
        if (!schema || !schema.properties) return {};
        
        const sample: any = {};
        for (const [key, prop] of Object.entries(schema.properties as any)) {
            const propSchema = prop as any;
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

    public updateSettings(settings: MCPServerSettings): void {
        this.settings = settings;
        if (this.httpServer) {
            this.stop();
            this.start().catch(err => console.error('[MCPServer] Failed to restart after settings update:', err));
        }
    }
}

// HTTP transport doesn't need persistent connections
// MCP over HTTP uses request-response pattern