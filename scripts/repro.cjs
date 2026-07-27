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
 * Optional bug-queue commands (list / replay / close / attempt) operate on a
 * JSONL file written by an external detector; they are inert unless a queue is
 * found. Resolution order: --queue <path>, $COCOS_MCP_QUEUE,
 * $CLAUDE_PROJECT_DIR/.claude/state/cocos-mcp-bugs.jsonl, then the nearest
 * .claude/state/cocos-mcp-bugs.jsonl walking up from the working directory.
 *
 * Port: --port <n>, else $COCOS_MCP_PORT, else 3000.
 * Exit code is 1 when a call fails, so it can gate a shell script.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const HOST = '127.0.0.1';
const QUEUE_RELATIVE = path.join('.claude', 'state', 'cocos-mcp-bugs.jsonl');

const argv = process.argv.slice(2);

function takeFlag(name) {
    const i = argv.indexOf(name);
    if (i === -1) return null;
    const value = argv[i + 1];
    argv.splice(i, 2);
    return value;
}

const PORT = parseInt(takeFlag('--port') || process.env.COCOS_MCP_PORT || '3000', 10);
const QUEUE_OVERRIDE = takeFlag('--queue');

/** Nearest .claude/state/cocos-mcp-bugs.jsonl at or above `from`, or null. */
function findQueueUpwards(from) {
    let dir = path.resolve(from);
    while (true) {
        const candidate = path.join(dir, QUEUE_RELATIVE);
        if (fs.existsSync(candidate)) return candidate;
        const parent = path.dirname(dir);
        if (parent === dir) return null;
        dir = parent;
    }
}

function queuePath() {
    if (QUEUE_OVERRIDE) return QUEUE_OVERRIDE;
    if (process.env.COCOS_MCP_QUEUE) return process.env.COCOS_MCP_QUEUE;
    if (process.env.CLAUDE_PROJECT_DIR) {
        return path.join(process.env.CLAUDE_PROJECT_DIR, QUEUE_RELATIVE);
    }
    return findQueueUpwards(process.cwd());
}

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

function readQueue() {
    const file = queuePath();
    if (!file || !fs.existsSync(file)) return { file, records: [] };
    const records = fs
        .readFileSync(file, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((line) => {
            try {
                return JSON.parse(line);
            } catch {
                return null;
            }
        })
        .filter(Boolean);
    return { file, records };
}

function writeQueue(file, records) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, records.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8');
}

function requireQueue() {
    const { file, records } = readQueue();
    if (!file || !fs.existsSync(file)) {
        die(
            'no bug queue found. Pass --queue <path>, set $COCOS_MCP_QUEUE, or run from a\n' +
                'project containing .claude/state/cocos-mcp-bugs.jsonl'
        );
    }
    return { file, records };
}

function findRecord(records, ref) {
    if (ref === '--last') {
        const open = records.filter((r) => r.status === 'open');
        return open[open.length - 1] || null;
    }
    return records.find((r) => r.fingerprint === ref) || null;
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
            const timeoutSec = parseInt(takeFlag('--timeout') || rest[0] || '120', 10);
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
            const result = unwrap(await request('POST', `/api/${tool}`, args));
            console.log(JSON.stringify(result, null, 2));
            process.exit(result && result.success === false ? 1 : 0);
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

        case 'list': {
            const { records } = requireQueue();
            const all = rest.includes('--all');
            const shown = records.filter((r) => all || r.status === 'open');
            if (!shown.length) {
                console.log('queue empty');
                process.exit(0);
            }
            for (const r of shown) {
                console.log(
                    `${r.fingerprint}  [${r.status}] ${r.tool}.${r.action || '-'}  ` +
                        `attempts=${r.attempts}  ${String(r.error).slice(0, 90)}`
                );
            }
            break;
        }

        case 'replay': {
            const ref = rest[0];
            if (!ref) die('usage: replay <fingerprint|--last>');
            const { records } = requireQueue();
            const record = findRecord(records, ref);
            if (!record) die(`no record for ${ref}`);
            const result = unwrap(await request('POST', `/api/${record.tool}`, record.args || {}));
            const stillBroken = result && result.success === false;
            console.log(JSON.stringify(result, null, 2));
            console.log(
                stillBroken
                    ? `\nFAIL — ${record.fingerprint} still reproduces`
                    : `\nPASS — ${record.fingerprint} fixed`
            );
            process.exit(stillBroken ? 1 : 0);
            break;
        }

        case 'close': {
            const ref = rest[0];
            if (!ref) die('usage: close <fingerprint> [note]');
            const { file, records } = requireQueue();
            const record = findRecord(records, ref);
            if (!record) die(`no record for ${ref}`);
            record.status = 'resolved';
            const note = rest.slice(1).join(' ');
            if (note) record.resolvedNote = note;
            writeQueue(file, records);
            console.log(`closed ${record.fingerprint}`);
            break;
        }

        case 'attempt': {
            const ref = rest[0];
            if (!ref) die('usage: attempt <fingerprint>');
            const { file, records } = requireQueue();
            const record = findRecord(records, ref);
            if (!record) die(`no record for ${ref}`);
            record.attempts = (record.attempts || 0) + 1;
            writeQueue(file, records);
            console.log(`${record.fingerprint} attempts=${record.attempts}`);
            break;
        }

        default:
            die(
                'usage: node scripts/repro.cjs <command> [args] [--port N] [--queue path]\n\n' +
                    '  health                       is the server answering?\n' +
                    '  wait [--timeout 120]         poll until it answers (use after an editor reload)\n' +
                    "  call <tool> '<jsonArgs>'     invoke one tool, print its result\n" +
                    '  tools [filter]               list registered tool names\n\n' +
                    '  list [--all]                 queued bug records\n' +
                    '  replay <fingerprint|--last>  re-issue a recorded call; PASS = fixed\n' +
                    '  close <fingerprint> [note]   mark a record resolved\n' +
                    '  attempt <fingerprint>        bump the attempt counter\n'
            );
    }
}

main().catch((err) => die(`error: ${err.stack || err.message}`));
