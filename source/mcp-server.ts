import * as http from 'http';
import * as url from 'url';
import { v4 as uuidv4 } from 'uuid';
import { MCPServerSettings, ServerStatus, MCPClient, ToolDefinition, ActionToolExecutor } from './types';
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

export class MCPServer {
    private settings: MCPServerSettings;
    private httpServer: http.Server | null = null;
    private clients: Map<string, MCPClient> = new Map();
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

    public getClients(): MCPClient[] {
        return Array.from(this.clients.values());
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
        
        // Set CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.setHeader('Content-Type', 'application/json');
        
        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }
        
        try {
            if (pathname === '/mcp' && req.method === 'POST') {
                await this.handleMCPRequest(req, res);
            } else if (pathname === '/health' && req.method === 'GET') {
                res.writeHead(200);
                res.end(JSON.stringify({ status: 'ok', tools: this.toolsList.length }));
            } else if (pathname?.startsWith('/api/') && req.method === 'POST') {
                await this.handleSimpleAPIRequest(req, res, pathname);
            } else if (pathname === '/api/tools' && req.method === 'GET') {
                res.writeHead(200);
                res.end(JSON.stringify({ tools: this.getSimplifiedToolsList() }));
            } else {
                res.writeHead(404);
                res.end(JSON.stringify({ error: 'Not found' }));
            }
        } catch (error) {
            console.error('HTTP request error:', error);
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Internal server error' }));
        }
    }
    
    private async handleMCPRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        let body = '';
        
        req.on('data', (chunk) => {
            body += chunk.toString();
        });
        
        req.on('end', async () => {
            try {
                // Enhanced JSON parsing with better error handling
                let message;
                try {
                    message = JSON.parse(body);
                } catch (parseError: any) {
                    // Try to fix common JSON issues
                    const fixedBody = this.fixCommonJsonIssues(body);
                    try {
                        message = JSON.parse(fixedBody);
                        console.log('[MCPServer] Fixed JSON parsing issue');
                    } catch (secondError) {
                        throw new Error(`JSON parsing failed: ${parseError.message}. Original body: ${body.substring(0, 500)}...`);
                    }
                }
                
                const response = await this.handleMessage(message);
                res.writeHead(200);
                res.end(JSON.stringify(response));
            } catch (error: any) {
                console.error('Error handling MCP request:', error);
                res.writeHead(400);
                res.end(JSON.stringify({
                    jsonrpc: '2.0',
                    id: null,
                    error: {
                        code: -32700,
                        message: `Parse error: ${error.message}`
                    }
                }));
            }
        });
    }

    private async handleMessage(message: any): Promise<any> {
        const { id, method, params } = message;

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
                    throw new Error(`Unknown method: ${method}`);
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

    private fixCommonJsonIssues(jsonStr: string): string {
        let fixed = jsonStr;
        
        // Fix common escape character issues
        fixed = fixed
            // Fix unescaped quotes in strings
            .replace(/([^\\])"([^"]*[^\\])"([^,}\]:])/g, '$1\\"$2\\"$3')
            // Fix unescaped backslashes
            .replace(/([^\\])\\([^"\\\/bfnrt])/g, '$1\\\\$2')
            // Fix trailing commas
            .replace(/,(\s*[}\]])/g, '$1')
            // Fix single quotes (should be double quotes)
            .replace(/'/g, '"')
            // Fix common control characters
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t');
        
        return fixed;
    }

    public stop(): void {
        if (this.httpServer) {
            this.httpServer.close();
            this.httpServer = null;
            console.log('[MCPServer] HTTP server stopped');
        }

        this.clients.clear();
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
        
        req.on('data', (chunk) => {
            body += chunk.toString();
        });
        
        req.on('end', async () => {
            try {
                // Extract tool name from path like /api/manage_node
                const pathParts = pathname.split('/').filter(p => p);
                if (pathParts.length < 2) {
                    res.writeHead(400);
                    res.end(JSON.stringify({ error: 'Invalid API path. Use /api/{tool_name}' }));
                    return;
                }

                const fullToolName = pathParts.slice(1).join('_');
                
                // Parse parameters with enhanced error handling
                let params;
                try {
                    params = body ? JSON.parse(body) : {};
                } catch (parseError: any) {
                    // Try to fix JSON issues
                    const fixedBody = this.fixCommonJsonIssues(body);
                    try {
                        params = JSON.parse(fixedBody);
                        console.log('[MCPServer] Fixed API JSON parsing issue');
                    } catch (secondError: any) {
                        res.writeHead(400);
                        res.end(JSON.stringify({
                            error: 'Invalid JSON in request body',
                            details: parseError.message,
                            receivedBody: body.substring(0, 200)
                        }));
                        return;
                    }
                }
                
                // Execute tool
                const result = await this.executeToolCall(fullToolName, params);
                
                res.writeHead(200);
                res.end(JSON.stringify({
                    success: true,
                    tool: fullToolName,
                    result: result
                }));
                
            } catch (error: any) {
                console.error('Simple API error:', error);
                res.writeHead(500);
                res.end(JSON.stringify({
                    success: false,
                    error: error.message,
                    tool: pathname
                }));
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

    public updateSettings(settings: MCPServerSettings) {
        this.settings = settings;
        if (this.httpServer) {
            this.stop();
            this.start();
        }
    }
}

// HTTP transport doesn't need persistent connections
// MCP over HTTP uses request-response pattern