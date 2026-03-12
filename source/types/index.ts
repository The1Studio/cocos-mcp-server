export interface MCPServerSettings {
    port: number;
    autoStart: boolean;
    enableDebugLog: boolean;
    allowedOrigins: string[];
    maxConnections: number;
}

export interface ServerStatus {
    running: boolean;
    port: number;
    clients: number;
}

export interface ToolDefinition {
    name: string;
    description: string;
    displayDescription?: string;
    inputSchema: any;
}

export interface ToolResponse {
    success: boolean;
    data?: any;
    message?: string;
    error?: string;
    instruction?: string;
    warning?: string;
    verificationData?: any;
    updatedProperties?: string[];
}

export interface NodeInfo {
    uuid: string;
    name: string;
    active: boolean;
    position?: { x: number; y: number; z: number };
    rotation?: { x: number; y: number; z: number };
    scale?: { x: number; y: number; z: number };
    parent?: string;
    children?: string[];
    components?: ComponentInfo[];
    layer?: number;
    mobility?: number;
}

export interface ComponentInfo {
    type: string;
    enabled: boolean;
    properties?: Record<string, any>;
}

export interface SceneInfo {
    name: string;
    uuid: string;
    path: string;
}

export interface PrefabInfo {
    name: string;
    uuid: string;
    path: string;
    folder: string;
    createTime?: string;
    modifyTime?: string;
    dependencies?: string[];
}

export interface AssetInfo {
    name: string;
    uuid: string;
    path: string;
    type: string;
    size?: number;
    isDirectory: boolean;
    meta?: {
        ver: string;
        importer: string;
    };
}

export interface ProjectInfo {
    name: string;
    path: string;
    uuid: string;
    version: string;
    cocosVersion: string;
}

export interface ConsoleMessage {
    timestamp: string;
    type: 'log' | 'warn' | 'error' | 'info';
    message: string;
    stack?: string;
}

export interface PerformanceStats {
    nodeCount: number;
    componentCount: number;
    drawCalls: number;
    triangles: number;
    memory: Record<string, any>;
}

export interface ValidationIssue {
    type: 'error' | 'warning' | 'info';
    category: string;
    message: string;
    details?: any;
    suggestion?: string;
}

export interface ValidationResult {
    valid: boolean;
    issueCount: number;
    issues: ValidationIssue[];
}

export interface MCPClient {
    id: string;
    lastActivity: Date;
    userAgent?: string;
}

export interface ToolExecutor {
    getTools(): ToolDefinition[];
    execute(toolName: string, args: any): Promise<ToolResponse>;
}

// === v2 Action-based Tool Types ===

/** Action-based tool executor interface */
export interface ActionToolExecutor {
    /** Tool name (e.g., 'manage_node') */
    readonly name: string;
    /** Tool description for LLM */
    readonly description: string;
    /** MCP input schema with action enum */
    readonly inputSchema: object;
    /** Execute an action with given arguments */
    execute(action: string, args: Record<string, any>): Promise<ActionToolResult>;
    /** List of supported actions */
    readonly actions: string[];
}

/** Standardized tool result — replaces ad-hoc ToolResponse */
export interface ActionToolResult {
    success: boolean;
    data?: any;
    message?: string;
    error?: string;
    /** Guidance for the LLM on how to correct the call or proceed */
    instruction?: string;
    /** When true, MCP response includes isError flag so LLM sees the failure */
    isError?: boolean;
}

/** Helper to create success responses */
export function successResult(data: any, message?: string): ActionToolResult {
    return { success: true, data, message };
}

/** Helper to create error responses */
export function errorResult(error: string): ActionToolResult {
    return { success: false, error, isError: true };
}

// Tool configuration management interfaces
export interface ToolConfig {
    category: string;
    name: string;
    enabled: boolean;
    description: string;
    displayDescription?: string;
}

export interface ToolConfiguration {
    id: string;
    name: string;
    description?: string;
    tools: ToolConfig[];
    createdAt: string;
    updatedAt: string;
}

export interface ToolManagerSettings {
    configurations: ToolConfiguration[];
    currentConfigId: string;
    maxConfigSlots: number;
}

export interface ToolManagerState {
    availableTools: ToolConfig[];
    currentConfiguration: ToolConfiguration | null;
    configurations: ToolConfiguration[];
}