export interface MCPResource {
    uri: string;
    name: string;
    description: string;
    mimeType: string;
}

export interface MCPResourceContent {
    uri: string;
    mimeType: string;
    text: string;
}

export interface ResourceProvider {
    readonly resources: MCPResource[];
    read(uri: string): Promise<MCPResourceContent>;
}
