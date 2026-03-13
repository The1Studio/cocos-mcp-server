# OpenCode MCP Research Report

**Date**: 2026-03-13 | **Researcher**: Claude Researcher | **Duration**: Comprehensive research across 10+ sources

---

## Executive Summary

**OpenCode** is an open-source AI coding CLI tool built in **Go** that serves as a viable alternative to Claude Code. It supports **MCP (Model Context Protocol) v2.0** with both local and remote server configurations via `opencode.json`. Unlike Claude Code's proprietary ecosystem, OpenCode features:
- Provider-agnostic model selection (75+ providers via Models.dev)
- Terminal-first TUI built with Bubble Tea
- Custom agents and skills system with SKILL.md format
- Two built-in agents: "build" (full access) and "plan" (read-only)
- Backward compatibility with Claude Code's `.claude/` directory structure

**Key Finding**: Migration from Claude Code to OpenCode is straightforward due to compatible directory conventions and a compatibility layer that reads `.claude/` directories as fallbacks.

---

## 1. What is OpenCode?

### Repository & Ownership
- **Primary Repo**: [github.com/opencode-ai/opencode](https://github.com/opencode-ai/opencode)
- **Alternative Repo**: [github.com/anomalyco/opencode](https://github.com/anomalyco/opencode) (older, less active)
- **Language**: **Go** (compiled CLI, single binary)
- **Architecture**: TUI (Terminal User Interface) with client/server design
- **Status**: Active development (anomalyco/opencode archived Sept 2025, development continues under "Crush")

### Core Purpose
OpenCode is a terminal-based AI coding agent providing:
- Chat-style interaction with AI models in the terminal
- Multi-file code editing with git awareness
- Shell command execution with safety controls
- Session persistence with SQLite backend
- Interactive diff preview before applying changes
- Vim-like editor integration

### Adoption Metrics
- **GitHub Stars**: 112K+ (outpaces Claude Code's 71K)
- **Contributors**: 800+
- **Usage Reality**: Claude Code dominates with 4% of public GitHub commits (~135K/day), despite OpenCode's star advantage

---

## 2. MCP Support & Configuration

### Configuration Files & Precedence

OpenCode merges config sources in this order (later override earlier):
1. Remote config (`.well-known/opencode`)
2. Global config (`~/.config/opencode/opencode.json`)
3. Custom config (`OPENCODE_CONFIG` env var)
4. Project config (`opencode.json` in project root)
5. `.opencode` directories
6. Inline config (`OPENCODE_CONFIG_CONTENT` env var)

### MCP Configuration Format

**Location**: Define in `opencode.json` (project root) under the `"mcp"` key.

**File Format**: JSON or JSONC (JSON with Comments)

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "server-name": {
      "type": "local" or "remote",
      "enabled": true
    }
  }
}
```

### Local MCP Servers

```json
{
  "mcp": {
    "my-local-mcp": {
      "type": "local",
      "command": ["npx", "-y", "my-mcp-command"],
      "environment": {
        "MY_ENV_VAR": "value"
      }
    }
  }
}
```

**Key Points**:
- Command is an array (similar to Node.js child_process spawn)
- Environment variables can be passed per-server
- OpenCode spawns and manages the process lifecycle

### Remote MCP Servers

```json
{
  "mcp": {
    "my-remote-mcp": {
      "type": "remote",
      "url": "https://mcp-server.com",
      "headers": {
        "Authorization": "Bearer API_KEY"
      }
    }
  }
}
```

**Key Features**:
- **OAuth Support**: Automatically handles OAuth flows on 401 responses
- **Custom Headers**: Support for API keys, bearer tokens, authorization
- **Per-Agent Control**: Enable/disable MCPs for specific agents via `"agent"` config

### MCP Management Features
- **CLI Wizard**: `opencode --add-mcp` guides through local or remote setup
- **Context Efficiency**: OpenCode tracks MCP token usage to prevent context overflow
- **Tool Access Control**: Global or per-agent MCP permissions with glob patterns

---

## 3. Agents & Skills System

### Agents Architecture

OpenCode supports **three agent modes**:
1. **Primary agent** — Main interaction agent (default: "build")
2. **Subagent** — Invoked via `@mention` syntax
3. **All mode** — Can function in both contexts

### Agent Definition Formats

**Option A: JSON in opencode.json**
```json
{
  "agent": {
    "agent-name": {
      "description": "What the agent does",
      "mode": "subagent",
      "model": "anthropic/claude-sonnet-4-20250514",
      "temperature": 0.1,
      "tools": {
        "write": true,
        "edit": false,
        "bash": false
      }
    }
  }
}
```

**Option B: Markdown in ~/.config/opencode/agents/ or .opencode/agents/**
```markdown
---
description: Agent purpose description
mode: subagent
model: anthropic/claude-sonnet-4-20250514
temperature: 0.1
tools:
  write: false
  edit: false
  bash: true
---
# Agent System Prompt

Detailed instructions for the agent...
Behavioral guidelines...
Context-specific rules...
```

### Agent Customization Options
- **model**: Override default model (e.g., use faster model for planning, capable model for implementation)
- **temperature**: Range 0.0–1.0 (0 = deterministic, 1 = creative)
- **prompt**: Reference external file with `{file:./prompts/file.txt}` syntax
- **tools**: Boolean flags for `write`, `edit`, `bash`, `webfetch`, `skill` access
- **permissions**: `"ask"`, `"allow"`, or `"deny"` for granular control

### Built-in Agents
- **build** (default): Full-access agent for development
- **plan** (read-only): Analysis and exploration agent without code modification

---

## 4. Skills System (SKILL.md Format)

### Skill Discovery

OpenCode automatically discovers skills from multiple locations (project-local takes precedence):
- `.opencode/skills/<name>/SKILL.md`
- `~/.config/opencode/skills/<name>/SKILL.md`
- `.claude/skills/<name>/SKILL.md` (Claude Code compatibility)
- `.agents/skills/<name>/SKILL.md`

### SKILL.md Structure

```yaml
---
name: skill-name                    # Required: 1-64 chars, lowercase alphanumeric + hyphens
description: Brief description     # Required: 1-1024 chars
license: MIT                        # Optional
compatibility: opencode            # Optional
metadata:                           # Optional: custom key-value pairs
  audience: maintainers
  category: devops
---
# Skill Content

Skill instructions, use cases, and detailed guidance...

## When to use this skill
...

## How to invoke this skill
...
```

### Skill Naming Convention
- **Pattern**: `^[a-z0-9]+(-[a-z0-9]+)*$`
- **Example**: `git-release`, `docker-build`, `test-runner`
- Directory name must match skill name

### Skill Loading & Access Control

**Auto-Discovery**:
- On session start, OpenCode injects list of available skills
- Agents see what skills are available without needing `get_available_skills` call
- Semantic similarity detection: Agent messages mentioning skill topics trigger auto-load suggestions

**Permission Control via opencode.json**:
```json
{
  "tools": {
    "skill": {
      "permissions": "ask",
      "allow": ["git-*", "build-*"],
      "deny": ["dangerous-*"]
    }
  }
}
```

### Key Differences from Claude Code Skills
- OpenCode skills are **lazy-loaded on-demand** (agents see names, load content when needed)
- Claude Code loads entire skill tree into context (higher token usage)
- OpenCode supports wildcard permission patterns (`internal-*`)
- Identical SKILL.md format enables cross-platform skill portability

---

## 5. Full Configuration Example

### Complete opencode.json Reference

```json
{
  "$schema": "https://opencode.ai/config.json",

  "model": "anthropic/claude-sonnet-4-20250514",
  "small_model": "anthropic/claude-haiku-4-5-20251001",
  "autoupdate": true,

  "server": {
    "port": 4096,
    "hostname": "localhost",
    "mdns": false,
    "cors": {
      "origins": ["http://localhost:3000"]
    }
  },

  "theme": "opencode",
  "tui": {
    "scroll_speed": 3,
    "scroll_acceleration": { "enabled": true },
    "diff_style": "unified"
  },

  "instructions": [
    "{file:./AGENTS.md}",
    "{file:.opencode/rules.md}"
  ],

  "agent": {
    "planner": {
      "description": "Planning and architecture specialist",
      "mode": "subagent",
      "model": "anthropic/claude-haiku-4-5-20251001",
      "temperature": 0.3,
      "tools": {
        "write": false,
        "edit": false,
        "bash": false
      }
    },
    "reviewer": {
      "description": "Code quality and security reviewer",
      "mode": "subagent",
      "model": "anthropic/claude-sonnet-4-20250514",
      "temperature": 0.1,
      "tools": {
        "write": false,
        "edit": false
      }
    }
  },

  "mcp": {
    "github": {
      "type": "remote",
      "url": "https://mcp.anthropic.com/github",
      "enabled": true
    },
    "my-local-tool": {
      "type": "local",
      "command": ["node", "./mcp-server.js"],
      "environment": {
        "API_KEY": "value"
      }
    }
  },

  "permissions": {
    "edit": "ask",
    "bash": "ask",
    "webfetch": "allow",
    "skill": "ask"
  },

  "commands": {
    "test": {
      "template": "Run tests for {arg}",
      "description": "Execute test suite",
      "agent": "build",
      "model": "anthropic/claude-haiku-4-5-20251001"
    }
  }
}
```

### Configuration Precedence Rules
- **Schema validation**: Use `$schema: "https://opencode.ai/config.json"` for IDE autocomplete
- **Project config wins**: `opencode.json` in project root overrides global
- **Env vars override all**: `OPENCODE_CONFIG_CONTENT` takes highest precedence
- **Merge behavior**: Configs merge for arrays (MCP servers, instructions), override for scalar values

---

## 6. Key Differences from Claude Code

| Feature | Claude Code | OpenCode |
|---------|------------|----------|
| **Language** | Proprietary (unknown) | Go |
| **Pricing** | $20/month minimum, up to $200/month | Free OSS + optional paid tier (OpenCode Black) |
| **Model Providers** | Anthropic Claude only | 75+ providers (Claude, GPT, Gemini, Deepseek, Ollama) |
| **Configuration** | JSON agents in `~/.claude/agents/` | YAML/Markdown agents in `~/.config/opencode/agents/` + JSON in `opencode.json` |
| **MCP Config** | Project-specific, less transparent | Explicit `opencode.json` with local/remote support |
| **Skills System** | Eager loading (full context injection) | Lazy loading (on-demand with semantic detection) |
| **Agent Modes** | Limited (main + subagents) | Three modes: primary, subagent, all |
| **Tool Permissions** | Simple enable/disable | Granular with `allow`/`deny`/`ask` patterns |
| **Persistence** | Session-based | SQLite backend (persistent workspaces) |
| **Backward Compat** | N/A | Reads `.claude/` as fallback (seamless migration) |
| **Context Efficiency** | Integrated optimization | Explicit MCP token tracking |
| **Customization** | Limited (CLI only) | Extensible (plugins, hooks, remote rules) |

---

## 7. Migration from Claude Code to OpenCode

### Compatibility Layer

OpenCode includes **Claude Code Compatibility** — automatically loads from `.claude/` directories if native `~/.config/opencode/` equivalents don't exist:

**Priority Order** (OpenCode reads first, Claude Code as fallback):
```
Project:
  ~/.config/opencode/           (OpenCode primary)
  .opencode/                    (OpenCode project)
  .claude/                      (Claude Code fallback)

Global:
  ~/.config/opencode/opencode.json    (OpenCode)
  ~/.config/opencode/AGENTS.md        (OpenCode rules)
  ~/.claude/CLAUDE.md                 (Claude Code rules)
  ~/.claude/skills/                   (Claude Code skills)
```

### Migration Steps

**Step 1: Move Agent Definitions**
- Source: `~/.claude/agents/*.md`
- Target: `~/.config/opencode/agents/`
- Format: Markdown is identical, just copy files as-is

**Step 2: Move Skills**
- Source: `~/.claude/skills/*/SKILL.md`
- Target: `~/.config/opencode/skills/`
- Format: SKILL.md format is compatible (may need minor YAML adjustments)

**Step 3: Convert Project Rules**
- Source: `./CLAUDE.md`
- Target: `./AGENTS.md` (or reference via `"instructions": ["{file:./CLAUDE.md}"]` in `opencode.json`)
- Format: Markdown, can use same content initially

**Step 4: Create opencode.json**
```json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "anthropic/claude-sonnet-4-20250514",
  "instructions": ["{file:./AGENTS.md}"]
}
```

**Step 5: Configure MCP Servers**
- If using MCP, add `"mcp"` section to `opencode.json`
- Format is cleaner than Claude Code's implicit configuration

### No Migration Tools Required
- ✅ Directories and file formats already compatible
- ✅ One team migrated 12 agents in a single day
- ✅ SKILL.md is interchangeable
- ✅ Fallback compatibility means gradual migration possible (no hard cutover)

---

## 8. Technology Stack & Architecture

### Core Technologies
- **Language**: Go (v1.20+)
- **TUI Framework**: Bubble Tea (bubbletea.sh)
- **Data Storage**: SQLite (for session persistence)
- **Code Intelligence**: LSP (Language Server Protocol) with 30+ built-in language servers
- **Terminal Support**: Cross-platform (Linux, macOS, Windows)

### Language Support
- **Primary**: TypeScript/Node.js (battle-tested)
- **Well-Supported**: Python, Go, Rust, Ruby, Java, C/C++, C#
- **Supported**: 30+ languages via LSP (Kotlin, Elixir, Vue, Svelte, PHP, Lua, Zig, Haskell, etc.)

### Deployment Architecture
- **Client/Server Design**: Enables remote execution in Docker containers, persistence across sessions
- **Workspaces Feature** (in development): Persistent sessions that survive laptop shutdown
- **Multi-Provider**: Plugin system for LLM providers, MCP servers, language servers

---

## 9. Unresolved Questions

1. **Plugin System Details**: What's the exact API for custom OpenCode plugins? How do they compare to Claude Code's hooks?
2. **Session Persistence**: How are SQLite sessions structured? Can they be migrated from Claude Code?
3. **Remote Rules URLs**: How exactly do remote `AGENTS.md` URLs work in config? Authentication mechanism?
4. **Context Window Optimization**: What algorithms does OpenCode use to track and prevent MCP token overflow?
5. **Workspaces Feature**: When will the "Workspaces" feature launch? What changes to config format needed?
6. **Performance Comparison**: Empirical latency/throughput data comparing OpenCode to Claude Code?
7. **Tool Ecosystem**: What's the current count of available MCP servers optimized for OpenCode?

---

## Sources

- [GitHub - opencode-ai/opencode](https://github.com/opencode-ai/opencode)
- [OpenCode Official Docs - Configuration](https://opencode.ai/docs/config/)
- [OpenCode Official Docs - MCP Servers](https://opencode.ai/docs/mcp-servers/)
- [OpenCode Official Docs - Agents](https://opencode.ai/docs/agents/)
- [OpenCode Official Docs - Skills](https://opencode.ai/docs/skills/)
- [OpenCode Official Docs - Rules](https://opencode.ai/docs/rules/)
- [OpenCode Official Website](https://opencode.ai/)
- [Claude Code Agents to OpenCode Agents - GitHub Gist](https://gist.github.com/RichardHightower/827c4b655f894a1dd2d14b15be6a33c0)
- [Medium - Migrating from Claude Code to OpenCode](https://medium.com/spillwave-solutions/claude-code-agents-to-opencode-agents-041f9c8e5ccd)
- [Comparing Claude Code vs OpenCode](https://www.andreagrandi.it/posts/comparing-claude-code-vs-opencode-testing-different-models/)
- [OpenCode vs Claude Code - DataCamp](https://www.datacamp.com/blog/opencode-vs-claude-code)
