#!/usr/bin/env node
/**
 * repro.cjs — command-line client for a running Cocos MCP Server.
 *
 * Calls a tool without an LLM in the loop, so a bug report can be reproduced,
 * and a fix verified, straight from a terminal. Also avoids the quoting mess
 * that `curl` + nested JSON causes on Windows shells.
 *
 * The server is stateless HTTP (see source/mcp-server.ts):
 *   GET  /health          -> { status: 'ok', tools: N }
 *   GET  /api/tools       -> registered tools
 *   POST /api/<tool_name> -> { success, tool, result }   result = ActionToolResult
 *
 * Usage:
 *   node scripts/repro.cjs health
 *   node scripts/repro.cjs wait [--timeout 120]
 *   node scripts/repro.cjs call manage_node '{"action":"get_all"}'
 *   node scripts/repro.cjs tools [filter]
 *
 * `wait` polls until the server answers again — use it after an editor reload,
 * since the port disappears for a few seconds while the extension re-loads.
 *
 * Port: --port <n>, else $COCOS_MCP_PORT, else 3000.
 * `call` exits 1 when the tool reports success:false, so it can gate a script.
 */

const http = require('http');

const HOST = '127.0.0.1';
const argv = process.argv.slice(2);

function takeFlag(name) {
    const i = argv.indexOf(name);
    if (i === -1) return null;
    const value = argv[i + 1];
    argv.splice(i, 2);
    return value;
}

const PORT = parseInt(takeFlag('--port') || process.env.COCOS_MCP_PORT || '3000', 10);

function request(method, urlPath, body) {
    return new Promise((resolve, reject) => {
        const payload = body === undefined ? null : Buffer.from(JSON.stringify(body));
        const req = http.request(
            {
                host: HOST,
                port: PORT,
                path: urlPath,
                method,
                // No Origin header on purpose — the server rejects unknown origins.
                headers: payload
                    ? { 'Content-Type': 'application/json', 'Content-Length': payload.length }
                    : {},
                timeout: 60000,
            },
            (res) => {
                let data = '';
                res.on('data', (chunk) => (data += chunk));
                res.on('end', () => {
                    let parsed = null;
                    try {
                        parsed = JSON.parse(data);
                    } catch {
                        /* caller falls back to raw */
                    }
                    resolve({ status: res.statusCode, body: parsed, raw: data });
                });
            }
        );
        req.on('timeout', () => req.destroy(new Error('timeout')));
        req.on('error', reject);
        if (payload) req.write(payload);
        req.end();
    });
}

function die(message, code = 1) {
    console.error(message);
    process.exit(code);
}

/** Unwrap { success, tool, result } down to the ActionToolResult. */
function unwrap(res) {
    return res.body && res.body.result ? res.body.result : res.body;
}

async function main() {
    // Extract per-case flags BEFORE destructuring `rest` — `rest` is a snapshot copy of
    // argv taken at the point of destructuring, so a later `takeFlag()` call (which
    // mutates `argv` in place) never removes the flag from `rest`, and `rest[0]` is left
    // holding the flag token itself (e.g. "--timeout") instead of the value or the next
    // positional arg. Mirrors how `--port` is already extracted before argv is consumed.
    const timeoutFlag = takeFlag('--timeout');
    const [cmd, ...rest] = argv;

    switch (cmd) {
        case 'health': {
            try {
                const res = await request('GET', '/health');
                if (res.status === 200 && res.body && res.body.status === 'ok') {
                    console.log(`OK — ${res.body.tools} tools on :${PORT}`);
                    process.exit(0);
                }
                die(`UNHEALTHY — HTTP ${res.status}: ${res.raw.slice(0, 200)}`);
            } catch (err) {
                die(`DOWN — ${err.message} (is the editor open with the extension running?)`);
            }
            break;
        }

        case 'wait': {
            const timeoutSec = parseInt(timeoutFlag || rest[0] || '120', 10);
            const deadline = Date.now() + timeoutSec * 1000;
            while (Date.now() < deadline) {
                try {
                    const res = await request('GET', '/health');
                    if (res.status === 200 && res.body && res.body.status === 'ok') {
                        console.log(`UP — ${res.body.tools} tools on :${PORT}`);
                        process.exit(0);
                    }
                } catch {
                    /* still restarting — only the deadline decides */
                }
                await new Promise((r) => setTimeout(r, 2000));
            }
            die(`TIMEOUT — no answer within ${timeoutSec}s`);
            break;
        }

        case 'call': {
            const tool = rest[0];
            if (!tool) die("usage: call <tool> '<jsonArgs>'");
            let args = {};
            if (rest[1]) {
                try {
                    args = JSON.parse(rest[1]);
                } catch (err) {
                    die(`bad JSON args: ${err.message}`);
                }
            }
            const res = await request('POST', `/api/${tool}`, args);
            const result = unwrap(res);
            console.log(JSON.stringify(result, null, 2));
            // A non-200 status (bad tool name, malformed request, server error) must fail
            // the gate the same way a { success: false } result does — `health` and `wait`
            // already gate on res.status === 200; `call` silently ignored it and only ever
            // exited 1 on an explicit success:false, which unwrap() may not even produce
            // (e.g. a non-JSON error body unwraps to `res.body` itself, `null`).
            process.exit(res.status !== 200 || (result && result.success === false) ? 1 : 0);
            break;
        }

        case 'tools': {
            const res = await request('GET', '/api/tools');
            const list = Array.isArray(res.body) ? res.body : res.body && res.body.tools;
            if (!list) {
                console.log(res.raw);
                process.exit(0);
            }
            const filter = rest[0];
            for (const tool of list) {
                const name = tool.name || tool;
                if (filter && !String(name).includes(filter)) continue;
                console.log(name);
            }
            break;
        }

        default:
            die(
                'usage: node scripts/repro.cjs <command> [args] [--port N]\n\n' +
                    '  health                     is the server answering?\n' +
                    '  wait [--timeout 120]       poll until it answers (use after an editor reload)\n' +
                    "  call <tool> '<jsonArgs>'   invoke one tool, print its result\n" +
                    '  tools [filter]             list registered tool names\n'
            );
    }
}

main().catch((err) => die(`error: ${err.stack || err.message}`));
