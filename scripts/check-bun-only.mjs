#!/usr/bin/env bun
/**
 * Bun-only guard.
 *
 * Fails if a live file invokes node/npm/npx/pnpm/yarn or configures a
 * non-Bun toolchain. Historical/planning docs, CHANGELOGs, lockfiles and
 * node_modules are ignored. `node:` imports and node_modules paths are legal.
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative, basename, extname } from "node:path";

const ROOT = process.cwd();
const IGNORE_DIRS = new Set([
  "node_modules", ".git", "plans", "archive", "dist", "build", "coverage",
  "vendor", ".cache", ".turbo",
]);
const IGNORE_FILE = /^(CHANGELOG|.*\.lock$|bun\.lock$|bun\.lockb$|.*\.snap$)/;
const SELF = "scripts/check-bun-only.mjs";
const BUN_VERSION = "1.4.3";

const PREFIX = String.raw`(?:(?:sudo|exec|command|nohup|time)(?:\s+-\S+)*\s+|env(?:\s+-[^\s]+)*\s+|timeout\s+\S+\s+|xargs(?:\s+-\S+)*\s+)*(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)*`;
const BIN = String.raw`(?:${PREFIX})?(node|npm|npx|pnpm|yarn)(?=[ \t]|$)`;
const BIN_ARG = String.raw`(?:${PREFIX})?(node|npm|npx|pnpm|yarn)(?=[ \t]+\S)`;
const CMD_ARG = new RegExp(String.raw`(?:^|[;&|()` + "`" + String.raw`{])[ \t]*(?:${BIN_ARG})`, "m");
const SPAWN_BARE = /\b(?:spawn|spawnSync|execFile|execFileSync|exec|execSync|fork)\(\s*['"](node|npm|npx|pnpm|yarn)['"]/;
const COMMAND_KEYS = /^(command|cmd|exec|executable|shell|installCmd|updateCmd|uninstallCmd|run)$/;
const CMD = new RegExp(String.raw`(?:^|(?<=[;&|()` + "`" + String.raw`{]))[ \t]*(?:${BIN})`);
const ANY_CMD_ANYWHERE = new RegExp(String.raw`(?:^|[;&|()` + "`" + String.raw`{])[ \t]*(?:${BIN})`, "m");
const USE_NODE = /uses:\s*actions\/setup-node@/;
const USE_PNPM = /uses:\s*pnpm\/action-setup@/;
const NODE_VER = /^\s*node-version(-file)?:/;
const NODE_CACHE = /^\s*cache:\s*(npm|pnpm|yarn)\s*$/;
const NPM_ECO = /^\s*package-ecosystem:\s*["']?(npm|pnpm|yarn)["']?\s*$/;
const SHEBANG = /^#!.*\b(node|nodejs)\b/;
const TS_RUNTIME = /"(tsx|ts-node|nodemon)"\s*:/;

const errors = [];
const push = (file, line, msg) => errors.push(`${relative(ROOT, file)}:${line}: ${msg}`);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.has(entry.name)) walk(join(dir, entry.name), out);
    } else if (entry.isFile()) {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

function checkShellLine(file, i, line, why = "") {
  if (SHEBANG.test(line)) return push(file, i + 1, "node shebang");
  const m = CMD.exec(line);
  if (m) push(file, i + 1, `forbidden invocation "${m[1]}"${why}`);
}

function checkPackageJson(file) {
  let data;
  try { data = JSON.parse(readFileSync(file, "utf8")); } catch { return; }
  const scripts = data.scripts || {};
  for (const [name, value] of Object.entries(scripts)) {
    if (typeof value !== "string") continue;
    const m = ANY_CMD_ANYWHERE.exec(value);
    if (m) push(file, 0, `script "${name}" invokes "${m[1]}"`);
    if (/\b(tsx|ts-node|nodemon)\b/.test(value)) push(file, 0, `script "${name}" uses a non-Bun runtime`);
  }
  if (data.engines && data.engines.node) push(file, 0, "engines.node is declared");
  if (data.packageManager && !String(data.packageManager).startsWith("bun@")) {
    push(file, 0, `packageManager is ${data.packageManager}`);
  }
  const raw = readFileSync(file, "utf8");
  if (TS_RUNTIME.test(raw)) push(file, 0, "tsx/ts-node/nodemon dependency");
}

function checkYaml(file, text) {
  const lines = text.split("\n");
  let runIndent = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (USE_NODE.test(line)) push(file, i + 1, "actions/setup-node");
    if (USE_PNPM.test(line)) push(file, i + 1, "pnpm/action-setup");
    if (NODE_VER.test(line)) push(file, i + 1, "node-version pin");
    if (NODE_CACHE.test(line)) push(file, i + 1, "non-Bun dependency cache");
    if (NPM_ECO.test(line)) push(file, i + 1, "non-Bun dependabot ecosystem");
    const indent = line.length - line.trimStart().length;
    const run = /^\s*-?\s*run:\s*(.*)$/.exec(line);
    if (run) {
      if (/^[|>]/.test(run[1].trim())) { runIndent = indent; continue; }
      checkShellLine(file, i, run[1], " in run:");
      continue;
    }
    if (runIndent >= 0) {
      if (trimmed === "" || indent > runIndent) {
        checkShellLine(file, i, line, " in run:");
        continue;
      }
      runIndent = -1;
    }
  }
}

function checkMarkdown(file, text) {
  let fence = null;
  text.split("\n").forEach((line, i) => {
    const fm = /^\s*(```|~~~)/.exec(line);
    if (fm) { fence = fence ? null : fm[1]; return; }
    if (fence) {
      if (USE_NODE.test(line)) push(file, i + 1, "actions/setup-node");
      if (USE_PNPM.test(line)) push(file, i + 1, "pnpm/action-setup");
      if (NODE_VER.test(line)) push(file, i + 1, "node-version pin");
      if (NODE_CACHE.test(line)) push(file, i + 1, "non-Bun dependency cache");
      if (NPM_ECO.test(line)) push(file, i + 1, "non-Bun dependabot ecosystem");
      checkShellLine(file, i, line);
      return;
    }
    for (const m of line.matchAll(/`([^`\n]+)`/g)) {
      const hit = CMD_ARG.exec(m[1]);
      if (hit) {
        push(file, i + 1, `inline command "${hit[1]}"`);
        break;
      }
    }
    if (/^\s*(?:\$ )?(sudo )?(?:node|npm|npx|pnpm|yarn)\b/.test(line)) {
      checkShellLine(file, i, line);
    }
  });
}

const files = walk(ROOT).filter((f) => {
  const rel = relative(ROOT, f);
  return rel !== SELF && !IGNORE_FILE.test(basename(f));
});

for (const file of files) {
  const name = basename(file);
  if (name === "package-lock.json" || name === "pnpm-lock.yaml" || name === "yarn.lock" ||
      name === "npm-shrinkwrap.json" || name === "pnpm-workspace.yaml" || name === ".nvmrc" ||
      name === ".node-version") {
    push(file, 0, "non-Bun package-manager file");
    continue;
  }
  if (statSync(file).size > 2_000_000) continue;
  let text;
  try { text = readFileSync(file, "utf8"); } catch { continue; }
  const ext = extname(name);
  if (name === "package.json") { checkPackageJson(file); continue; }
  if (ext === ".yml" || ext === ".yaml") { checkYaml(file, text); continue; }
  if (ext === ".md" || ext === ".mdx") { checkMarkdown(file, text); continue; }
  if (ext === ".sh" || ext === ".bash") {
    text.split("\n").forEach((l, i) => checkShellLine(file, i, l));
    continue;
  }
  if (name.startsWith("Dockerfile") || name.endsWith(".Dockerfile")) {
    if (/^FROM\s+\S*node:/m.test(text)) push(file, 0, "node Docker base image");
    text.split("\n").forEach((l, i) => checkShellLine(file, i, l));
    continue;
  }
  const firstLine = text.split("\n", 1)[0];
  if (SHEBANG.test(firstLine)) push(file, 1, "node shebang");
  if (ext === ".js" || ext === ".cjs" || ext === ".mjs" || ext === ".ts" || ext === ".tsx" || ext === ".json") {
    const spawn = SPAWN_BARE.exec(text);
    if (spawn) push(file, 0, `forbidden program "${spawn[1]}" passed to spawn/exec`);
    for (const m of text.matchAll(/(['"`])([^'"`\n]{0,300}?)\1/g)) {
      const inner = m[2];
      const hit = CMD_ARG.exec(inner);
      if (hit) { push(file, 0, `forbidden invocation "${hit[1]}" in source string`); break; }
    }
    if (ext === ".json") {
      try {
        const walk = (v, key) => {
          if (typeof v === "string") {
            if (COMMAND_KEYS.test(key) && /^(sudo\s+)?(node|npm|npx|pnpm|yarn)(\s|$)/.test(v)) {
              push(file, 0, `"${key}" runs a non-Bun command`);
            }
          } else if (Array.isArray(v)) v.forEach((x) => walk(x, key));
          else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, k);
        };
        walk(JSON.parse(text), "");
      } catch {}
    }
  }
}

if (errors.length) {
  console.error(`bun-only: ${errors.length} violation(s)\n`);
  for (const e of errors.slice(0, 200)) console.error("  " + e);
  if (errors.length > 200) console.error(`  ... ${errors.length - 200} more`);
  process.exit(1);
}
console.log("bun-only: clean");
