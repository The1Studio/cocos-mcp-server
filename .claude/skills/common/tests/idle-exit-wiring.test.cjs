/**
 * Wiring test: each viewer server, started for real with a short idle window,
 * must exit 0 on its own and remove its pidfile. A 1.2 s window keeps this fast;
 * the hard kill deadline only fires on the unfixed code (no self-exit).
 * Run: node --test .claude/skills/common/tests/idle-exit-wiring.test.cjs
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SKILLS_DIR = path.resolve(__dirname, '..', '..');
const DEADLINE_MS = 8000;
const IDLE_MINUTES = '0.02'; // 1.2 s

const SERVERS = [
  {
    name: 'plans-kanban',
    script: path.join(SKILLS_DIR, 'plans-kanban', 'scripts', 'server.cjs'),
    pidLib: path.join(SKILLS_DIR, 'plans-kanban', 'scripts', 'lib', 'process-mgr.cjs'),
    basePort: 3531,
    extraArgs: [],
  },
  {
    name: 'markdown-novel-viewer',
    script: path.join(SKILLS_DIR, 'markdown-novel-viewer', 'scripts', 'server.cjs'),
    pidLib: path.join(SKILLS_DIR, 'markdown-novel-viewer', 'scripts', 'lib', 'process-mgr.cjs'),
    basePort: 3481,
    extraArgs: ['--no-open'],
  },
];

const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'idle-exit-fixture-'));
fs.writeFileSync(path.join(fixtureDir, 'plan.md'), '# fixture\n');
test.after(() => fs.rmSync(fixtureDir, { recursive: true, force: true }));

function runUntilExit(server) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [server.script, '--dir', fixtureDir, '--port', String(server.basePort), '--foreground',
        '--idle-timeout', IDLE_MINUTES, ...server.extraArgs],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    const killer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL'); // only ever our own child
    }, DEADLINE_MS);
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      clearTimeout(killer);
      resolve({ code, signal, timedOut, stdout, stderr });
    });
  });
}

for (const server of SERVERS) {
  test(`${server.name} exits on its own after the idle window and removes its pidfile`, async () => {
    const result = await runUntilExit(server);
    assert.equal(result.timedOut, false,
      `${server.name} was still running ${DEADLINE_MS} ms after a ${IDLE_MINUTES} min idle window (stderr: ${result.stderr.trim()})`);
    assert.equal(result.code, 0, `expected exit 0, got ${result.code} (${result.stderr.trim()})`);

    const port = JSON.parse(result.stdout.trim().split('\n')[0]).port;
    const { getPidFilePath } = require(server.pidLib);
    assert.equal(fs.existsSync(getPidFilePath(port)), false, 'pidfile must be removed on idle exit');
  });
}
