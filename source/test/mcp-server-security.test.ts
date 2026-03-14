import * as http from 'http';
import { MCPServer } from '../mcp-server';
import { MCPServerSettings } from '../types';

const BASE_SETTINGS: MCPServerSettings = {
    port: 0, // OS assigns free port
    autoStart: false,
    enableDebugLog: false,
    allowedOrigins: [],
    maxConnections: 10,
};

function makeSettings(overrides: Partial<MCPServerSettings> = {}): MCPServerSettings {
    return { ...BASE_SETTINGS, ...overrides };
}

/** POST JSON to a running server, returns { statusCode, body } */
async function post(port: number, path: string, body: any, headers: Record<string, string> = {}): Promise<{ statusCode: number; body: any }> {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify(body);
        const req = http.request(
            { hostname: '127.0.0.1', port, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload), ...headers } },
            (res) => {
                let data = '';
                res.on('data', (chunk) => (data += chunk));
                res.on('end', () => {
                    try { resolve({ statusCode: res.statusCode!, body: JSON.parse(data) }); }
                    catch { resolve({ statusCode: res.statusCode!, body: data }); }
                });
            }
        );
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

/** Helper to start server and get assigned port */
async function startServer(settings: MCPServerSettings): Promise<{ server: MCPServer; port: number }> {
    const server = new MCPServer(settings);
    await server.start();
    const port = (server as any).httpServer.address().port as number;
    return { server, port };
}

describe('MCPServer security', () => {
    let server: MCPServer;
    let port: number;

    beforeEach(async () => {
        ({ server, port } = await startServer(makeSettings()));
    });

    afterEach(async () => {
        await server.stop();
    });

    describe('Body size limit', () => {
        it('rejects requests larger than 1MB', async () => {
            // Build a payload just over 1MB
            const bigScript = 'x'.repeat(1024 * 1024 + 1);
            try {
                const result = await post(port, '/mcp', {
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'tools/call',
                    params: { name: 'manage_debug', arguments: { action: 'execute_script', script: bigScript } },
                });
                // If we get a response, it should be 413
                expect(result.statusCode).toBe(413);
            } catch (err: any) {
                // Server may destroy socket before responding — connection reset is also valid DoS protection
                expect(['ECONNRESET', 'socket hang up']).toContain(err.message || err.code);
            }
        });

        it('accepts requests under 1MB', async () => {
            const result = await post(port, '/mcp', {
                jsonrpc: '2.0',
                id: 1,
                method: 'tools/list',
            });
            expect(result.statusCode).toBe(200);
        });
    });

    describe('JSON-RPC field validation', () => {
        it('returns -32600 when jsonrpc field is missing', async () => {
            const result = await post(port, '/mcp', { id: 1, method: 'tools/list' });
            expect(result.statusCode).toBe(200);
            expect(result.body.error.code).toBe(-32600);
        });

        it('returns -32601 for unknown method', async () => {
            const result = await post(port, '/mcp', { jsonrpc: '2.0', id: 1, method: 'unknown/method' });
            expect(result.statusCode).toBe(200);
            expect(result.body.error.code).toBe(-32601);
        });

        it('returns -32700 on malformed JSON', async () => {
            await new Promise<void>((resolve, reject) => {
                const req = http.request(
                    { hostname: '127.0.0.1', port, path: '/mcp', method: 'POST', headers: { 'Content-Type': 'application/json' } },
                    (res) => {
                        let data = '';
                        res.on('data', (c) => (data += c));
                        res.on('end', () => {
                            expect(res.statusCode).toBe(400);
                            const body = JSON.parse(data);
                            expect(body.error.code).toBe(-32700);
                            resolve();
                        });
                    }
                );
                req.on('error', reject);
                req.write('{not valid json');
                req.end();
            });
        });
    });

    describe('CORS enforcement', () => {
        it('allows all origins when allowedOrigins is empty', async () => {
            const result = await post(port, '/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/list' }, { Origin: 'http://unknown.example' });
            expect(result.statusCode).toBe(200);
        });
    });

    describe('CORS enforcement with restricted origins', () => {
        let restrictedServer: MCPServer;
        let restrictedPort: number;

        beforeEach(async () => {
            ({ server: restrictedServer, port: restrictedPort } = await startServer(
                makeSettings({ allowedOrigins: ['http://allowed.example'] })
            ));
        });

        afterEach(async () => {
            await restrictedServer.stop();
        });

        it('returns 403 for disallowed origin', async () => {
            const result = await post(restrictedPort, '/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/list' }, { Origin: 'http://evil.example' });
            expect(result.statusCode).toBe(403);
        });

        it('allows requests from whitelisted origin', async () => {
            const result = await post(restrictedPort, '/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/list' }, { Origin: 'http://allowed.example' });
            expect(result.statusCode).toBe(200);
        });

        it('allows requests with no Origin header (non-browser clients)', async () => {
            const result = await post(restrictedPort, '/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/list' });
            expect(result.statusCode).toBe(200);
        });
    });
});
