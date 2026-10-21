---
name: ck:chrome-devtools
description: Automate browsers with Puppeteer CLI scripts and persistent sessions. Use for screenshots, performance analysis, network monitoring, web scraping, form automation, JavaScript debugging.
license: Apache-2.0
version: 1.1.0
argument-hint: "[url or task]"
---

# Chrome DevTools Agent Skill

Browser automation via Puppeteer scripts with persistent sessions. All scripts output JSON.

## Skill Location

Skills can exist in **project-scope** or **user-scope**. Priority: project-scope > user-scope.

```bash
# Detect skill location (no cd needed - scripts use __dirname for paths)
SKILL_DIR=""
if [ -d ".claude/skills/chrome-devtools/scripts" ]; then
  SKILL_DIR=".claude/skills/chrome-devtools/scripts"
elif [ -d "$HOME/.claude/skills/chrome-devtools/scripts" ]; then
  SKILL_DIR="$HOME/.claude/skills/chrome-devtools/scripts"
fi
# Run scripts with full path: node "$SKILL_DIR/script.js" --args
```

## Choosing Your Approach

| Scenario | Approach |
|----------|----------|
| **Source-available sites** | Read source code first, write selectors directly |
| **Unknown layouts** | Use `aria-snapshot.js` for semantic discovery |
| **Visual inspection** | Take screenshots to verify rendering |
| **Debug issues** | Collect console logs, analyze with session storage |
| **Accessibility audit** | Use ARIA snapshot for semantic structure analysis |

## Automation Browsing Running Mode

Browser visibility is resolved automatically by `resolveHeadless()` in `lib/browser.js`:

| Environment | Default | Why |
|-------------|---------|-----|
| **macOS / Windows** | **Headed** (visible) | Better debugging, OAuth login support |
| **Linux / WSL** | **Headless** | Servers typically have no display |
| **CI** (`CI`, `GITHUB_ACTIONS`, `GITLAB_CI`, `JENKINS_URL` env vars) | **Headless** | No display available |

Override with `--headless true` or `--headless false` on any script.

- Run multiple scripts/sessions in parallel to simulate real user interactions.
- Run multiple scripts/sessions in parallel to simulate different device types (mobile, tablet, desktop).

## ARIA Snapshot (Element Discovery)

When page structure is unknown, use `aria-snapshot.js` to get a YAML-formatted accessibility tree with semantic roles, accessible names, states, and stable element references.

### Get ARIA Snapshot

```bash
# Generate ARIA snapshot and output to stdout
bun "$SKILL_DIR/aria-snapshot.js" --url https://example.com

# Save to file in snapshots directory
bun "$SKILL_DIR/aria-snapshot.js" --url https://example.com --output ./.claude/chrome-devtools/snapshots/page.yaml
```

### Example YAML Output

```yaml
- banner:
  - link "Hacker News" [ref=e1]
    /url: https://news.ycombinator.com
  - navigation:
    - link "new" [ref=e2]
    - link "past" [ref=e3]
    - link "comments" [ref=e4]
- main:
  - list:
    - listitem:
      - link "Show HN: My new project" [ref=e8]
      - text: "128 points by user 3 hours ago"
- contentinfo:
  - textbox [ref=e10]
    /placeholder: "Search"
```

### Interpreting ARIA Notation

| Notation | Meaning |
|----------|---------|
| `[ref=eN]` | Stable identifier for interactive elements |
| `[checked]` | Checkbox/radio is selected |
| `[disabled]` | Element is inactive |
| `[expanded]` | Accordion/dropdown is open |
| `[level=N]` | Heading hierarchy (1-6) |
| `/url:` | Link destination |
| `/placeholder:` | Input placeholder text |
| `/value:` | Current input value |

### Interact by Ref

Skills can exist in **project-scope** or **user-scope**. Priority: project-scope > user-scope.
Use `select-ref.js` to interact with elements by their ref:

```bash
# Click element with ref e5
bun "$SKILL_DIR/select-ref.js" --ref e5 --action click

# Fill input with ref e10
bun "$SKILL_DIR/select-ref.js" --ref e10 --action fill --value "search query"

# Get text content
bun "$SKILL_DIR/select-ref.js" --ref e8 --action text

# Screenshot specific element
bun "$SKILL_DIR/select-ref.js" --ref e1 --action screenshot --output ./logo.png

# Focus element
bun "$SKILL_DIR/select-ref.js" --ref e10 --action focus

# Hover over element
bun "$SKILL_DIR/select-ref.js" --ref e5 --action hover
```

### Store Snapshots

Skills can exist in **project-scope** or **user-scope**. Priority: project-scope > user-scope.
Store snapshots for analysis in `<project>/.claude/chrome-devtools/snapshots/`:

```bash
# Create snapshots directory
mkdir -p .claude/chrome-devtools/snapshots

# Capture and store with timestamp
SESSION="$(date +%Y%m%d-%H%M%S)"
bun "$SKILL_DIR/aria-snapshot.js" --url https://example.com --output .claude/chrome-devtools/snapshots/$SESSION.yaml
```

### Workflow: Unknown Page Structure

1. **Get snapshot** to discover elements:
   ```bash
   bun "$SKILL_DIR/aria-snapshot.js" --url https://example.com
   ```

2. **Identify target** from YAML output (e.g., `[ref=e5]` for a button)

3. **Interact by ref**:
   ```bash
   bun "$SKILL_DIR/select-ref.js" --ref e5 --action click
   ```

4. **Verify result** with screenshot or new snapshot:
   ```bash
   bun "$SKILL_DIR/screenshot.js" --output ./result.png
   ```

## Local HTML Files

Skills can exist in **project-scope** or **user-scope**. Priority: project-scope > user-scope.
**IMPORTANT**: Never browse local HTML files via `file://` protocol. Always serve via local server:
**Why**: `file://` protocol blocks many browser features (CORS, ES modules, fetch API, service workers). Local server ensures proper HTTP behavior.

```bash
# Option 1: npx serve (recommended)
bunx serve ./dist -p 3000 &
bun "$SKILL_DIR/navigate.js" --url http://localhost:3000

# Option 2: Python http.server
python -m http.server 3000 --directory ./dist &
bun "$SKILL_DIR/navigate.js" --url http://localhost:3000
```

**Note**: when port 3000 is busy, find an available port with `lsof -i :3000` and use a different one.

## Quick Start

```bash
# Install dependencies (one-time setup)
bun install --cwd "$SKILL_DIR"

# Test (browser stays running for session reuse)
bun "$SKILL_DIR/navigate.js" --url https://example.com
# Output: {"success": true, "url": "...", "title": "..."}
```

**Linux/WSL only**: Run `"$SKILL_DIR/install-deps.sh"` first for Chrome system libraries.

## Session Persistence

Browser state persists across script executions via WebSocket endpoint file (`.browser-session.json`).

**Default behavior**: Scripts disconnect but keep browser running for session reuse.

```bash
# First script: launches browser, navigates, disconnects (browser stays running)
bun "$SKILL_DIR/navigate.js" --url https://example.com/login

# Subsequent scripts: connect to existing browser, reuse page state
bun "$SKILL_DIR/fill.js" --selector "#email" --value "user@example.com"
bun "$SKILL_DIR/fill.js" --selector "#password" --value "secret"
bun "$SKILL_DIR/click.js" --selector "button[type=submit]"

# Close browser when done
bun "$SKILL_DIR/navigate.js" --url about:blank --close true
```

**Session management**:
- `--close true`: Close browser and clear session
- Default (no flag): Keep browser running for next script

## Available Scripts

Skills can exist in **project-scope** or **user-scope**. Priority: project-scope > user-scope.
All in `.claude/skills/chrome-devtools/scripts/`:

| Script | Purpose |
|--------|---------|
| `navigate.js` | Navigate to URLs |
| `screenshot.js` | Capture screenshots (auto-compress >5MB via Sharp) |
| `click.js` | Click elements |
| `fill.js` | Fill form fields |
| `evaluate.js` | Execute JS in page context |
| `snapshot.js` | Extract interactive elements (JSON format) |
| `aria-snapshot.js` | Get ARIA accessibility tree (YAML format with refs) |
| `select-ref.js` | Interact with elements by ref from ARIA snapshot |
| `console.js` | Monitor console messages/errors |
| `network.js` | Track HTTP requests/responses |
| `performance.js` | Measure Core Web Vitals |
| `ws-debug.js` | Debug WebSocket connections (basic) |
| `ws-full-debug.js` | Debug WebSocket with full events/frames |
| `inject-auth.js` | Inject cookies/tokens for authentication |
| `import-cookies.js` | Import cookies from JSON/Netscape file |
| `connect-chrome.js` | Connect to Chrome with remote debugging |

## Workflow Loop

1. **Execute** focused script for single task
2. **Observe** JSON output
3. **Assess** completion status
4. **Decide** next action
5. **Repeat** until done

## Writing Custom Test Scripts

Skills can exist in **project-scope** or **user-scope**. Priority: project-scope > user-scope.
For complex automation, write scripts to `<project>/.claude/chrome-devtools/tmp/`:

```bash
# Create tmp directory for test scripts
mkdir -p $SKILL_DIR/.claude/chrome-devtools/tmp

# Write a test script
cat > $SKILL_DIR/.claude/chrome-devtools/tmp/login-test.js << 'EOF'
import { getBrowser, getPage, disconnectBrowser, outputJSON } from '../scripts/lib/browser.js';

async function loginTest() {
  const browser = await getBrowser();
  const page = await getPage(browser);

  await page.goto('https://example.com/login');
  await page.type('#email', 'user@example.com');
  await page.type('#password', 'secret');
  await page.click('button[type=submit]');
  await page.waitForNavigation();

  outputJSON({
    success: true,
    url: page.url(),
    title: await page.title()
  });

  await disconnectBrowser();
}

loginTest();
EOF

# Run the test
bun $SKILL_DIR/.claude/chrome-devtools/tmp/login-test.js
```

**Key principles for custom scripts**:
- Single-purpose: one script, one task
- Always call `disconnectBrowser()` at the end (keeps browser running)
- Use `closeBrowser()` only when ending session completely
- Output JSON for easy parsing
- Plain JavaScript only in `page.evaluate()` callbacks

## Screenshots

Skills can exist in **project-scope** or **user-scope**. Priority: project-scope > user-scope.
Store screenshots for analysis in `<project>/.claude/chrome-devtools/screenshots/`:

```bash
# Basic screenshot
bun "$SKILL_DIR/screenshot.js" --url https://example.com --output ./.claude/chrome-devtools/screenshots/page.png

# Full page
bun "$SKILL_DIR/screenshot.js" --url https://example.com --output ./.claude/chrome-devtools/screenshots/page.png --full-page true

# Specific element
bun "$SKILL_DIR/screenshot.js" --url https://example.com --selector ".main-content" --output ./.claude/chrome-devtools/screenshots/element.png
```

### Auto-Compression (Sharp)

Screenshots >5MB auto-compress using Sharp (4-5x faster than ImageMagick):

```bash
# Default: compress if >5MB
bun "$SKILL_DIR/screenshot.js" --url https://example.com --output ./.claude/chrome-devtools/screenshots/page.png

# Custom threshold (3MB)
bun "$SKILL_DIR/screenshot.js" --url https://example.com --output ./.claude/chrome-devtools/screenshots/page.png --max-size 3

# Disable compression
bun "$SKILL_DIR/screenshot.js" --url https://example.com --output ./.claude/chrome-devtools/screenshots/page.png --no-compress
```

Store screenshots for analysis in `<project>/.claude/chrome-devtools/screenshots/`.

## Console Log Collection & Analysis

Skills can exist in **project-scope** or **user-scope**. Priority: project-scope > user-scope.

### Capture Logs

```bash
# Capture all logs for 10 seconds
bun "$SKILL_DIR/console.js" --url https://example.com --duration 10000

# Filter by type
bun "$SKILL_DIR/console.js" --url https://example.com --types error,warn --duration 5000
```

### Session Storage Pattern

Store logs for analysis in `<project>/.claude/chrome-devtools/logs/<session>/`:

```bash
# Create session directory
SESSION="$(date +%Y%m%d-%H%M%S)"
mkdir -p .claude/chrome-devtools/logs/$SESSION

# Capture and store
bun "$SKILL_DIR/console.js" --url https://example.com --duration 10000 > .claude/chrome-devtools/logs/$SESSION/console.json
bun "$SKILL_DIR/network.js" --url https://example.com > .claude/chrome-devtools/logs/$SESSION/network.json

# View errors
jq '.messages[] | select(.type=="error")' .claude/chrome-devtools/logs/$SESSION/console.json
```

### Root Cause Analysis

```bash
# 1. Check for JavaScript errors
bun "$SKILL_DIR/console.js" --url https://example.com --types error,pageerror --duration 5000 | jq '.messages'

# 2. Correlate with network failures
bun "$SKILL_DIR/network.js" --url https://example.com | jq '.requests[] | select(.response.status >= 400)'

# 3. Check specific error stack traces
bun "$SKILL_DIR/console.js" --url https://example.com --types error --duration 5000 | jq '.messages[].stack'
```

## Finding Elements

Skills can exist in **project-scope** or **user-scope**. Priority: project-scope > user-scope.
Use `snapshot.js` to discover selectors before interacting:

```bash
# Get all interactive elements
bun "$SKILL_DIR/snapshot.js" --url https://example.com | jq '.elements[] | {tagName, text, selector}'

# Find buttons
bun "$SKILL_DIR/snapshot.js" --url https://example.com | jq '.elements[] | select(.tagName=="button")'

# Find by text content
bun "$SKILL_DIR/snapshot.js" --url https://example.com | jq '.elements[] | select(.text | contains("Submit"))'
```

## Error Recovery

Skills can exist in **project-scope** or **user-scope**. Priority: project-scope > user-scope.
If script fails:

```bash
# 1. Capture current state (without navigating to preserve state)
bun "$SKILL_DIR/screenshot.js" --output ./.claude/skills/chrome-devtools/screenshots/debug.png

# 2. Get console errors
bun "$SKILL_DIR/console.js" --url about:blank --types error --duration 1000

# 3. Discover correct selector
bun "$SKILL_DIR/snapshot.js" | jq '.elements[] | select(.text | contains("Submit"))'

# 4. Try XPath if CSS fails
bun "$SKILL_DIR/click.js" --selector "//button[contains(text(),'Submit')]"
```

## Common Patterns

### Web Scraping
```bash
bun "$SKILL_DIR/evaluate.js" --url https://example.com --script "
  Array.from(document.querySelectorAll('.item')).map(el => ({
    title: el.querySelector('h2')?.textContent,
    link: el.querySelector('a')?.href
  }))
" | jq '.result'
```

### Form Automation
```bash
bun "$SKILL_DIR/navigate.js" --url https://example.com/form
bun "$SKILL_DIR/fill.js" --selector "#search" --value "query"
bun "$SKILL_DIR/click.js" --selector "button[type=submit]"
```

### Performance Testing
```bash
bun "$SKILL_DIR/performance.js" --url https://example.com | jq '.vitals'
```

## Script Options

All scripts support:
- `--headless true/false` - Override auto-detected headless mode (default: auto by OS)
- `--close true` - Close browser completely (default: stay running)
- `--timeout 30000` - Set timeout (ms)
- `--wait-until networkidle2` - Wait strategy

`navigate.js` additionally supports:
- `--wait-for-login <pattern>` - Interactive login: open headed, wait for URL regex match
- `--login-timeout <ms>` - Max wait for login completion (default: 300000 = 5 min)

## Troubleshooting
Skills can exist in **project-scope** or **user-scope**. Priority: project-scope > user-scope.

| Error | Solution |
|-------|----------|
| `Cannot find package 'puppeteer'` | Run `bun install` in scripts directory |
| `libnss3.so` missing (Linux) | Run `./install-deps.sh` |
| Element not found | Use `snapshot.js` to find correct selector |
| Script hangs | Use `--timeout 60000` or `--wait-until load` |
| Screenshot >5MB | Auto-compressed; use `--max-size 3` for lower |
| Session stale | Delete `.browser-session.json` and retry |

### Screenshot Analysis: Missing Images

If images don't appear in screenshots, they may be waiting for animation triggers:

1. **Scroll-triggered animations**: Scroll element into view first
   ```bash
   bun "$SKILL_DIR/evaluate.js" --script "document.querySelector('.lazy-image').scrollIntoView()"
   # Wait for animation
   bun "$SKILL_DIR/evaluate.js" --script "await new Promise(r => setTimeout(r, 1000))"
   bun "$SKILL_DIR/screenshot.js" --output ./result.png
   ```

2. **Sequential animation queue**: Wait longer and retry
   ```bash
   # First attempt
   bun "$SKILL_DIR/screenshot.js" --url http://localhost:3000 --output ./attempt1.png

   # Wait for animations to complete
   bun "$SKILL_DIR/evaluate.js" --script "await new Promise(r => setTimeout(r, 2000))"

   # Retry screenshot
   bun "$SKILL_DIR/screenshot.js" --output ./attempt2.png
   ```

3. **Intersection Observer animations**: Trigger by scrolling through page
   ```bash
   bun "$SKILL_DIR/evaluate.js" --script "window.scrollTo(0, document.body.scrollHeight)"
   bun "$SKILL_DIR/evaluate.js" --script "await new Promise(r => setTimeout(r, 1500))"
   bun "$SKILL_DIR/evaluate.js" --script "window.scrollTo(0, 0)"
   bun "$SKILL_DIR/screenshot.js" --output ./full-loaded.png --full-page true
   ```

## Authentication & Cookies

For accessing protected/authenticated pages, use one of these methods:

### Method 1: Inject Cookies Directly

Use when you have cookie values (from DevTools or manual extraction):

```bash
# Inject single cookie
bun "$SKILL_DIR/inject-auth.js" --url https://site.com \
  --cookies '[{"name":"session","value":"abc123","domain":".site.com"}]'

# Multiple cookies with all properties
bun "$SKILL_DIR/inject-auth.js" --url https://site.com \
  --cookies '[{"name":"session","value":"abc","domain":".site.com","httpOnly":true,"secure":true}]'

# With Bearer token header
bun "$SKILL_DIR/inject-auth.js" --url https://api.site.com \
  --token "Bearer eyJhbG..." --header Authorization
```

### Method 2: Import from Browser Extension

Best for complex auth (OAuth, multi-cookie sessions):

```bash
# 1. Install "Cookie-Editor" or "EditThisCookie" Chrome extension
# 2. Navigate to site → Log in manually
# 3. Click extension → Export as JSON → Save to cookies.json
# 4. Import into puppeteer session:

bun "$SKILL_DIR/import-cookies.js" --file ./cookies.json --url https://site.com

# Netscape format (from curl/wget):
bun "$SKILL_DIR/import-cookies.js" --file ./cookies.txt --format netscape --url https://site.com

# Only import cookies matching target domain:
bun "$SKILL_DIR/import-cookies.js" --file ./cookies.json --url https://site.com --strict-domain
```

### Method 3: Use Your Chrome Profile

Most reliable for complex auth (2FA, OAuth, SSO). Uses your existing Chrome session:

```bash
# Use Chrome's default profile (preserves all cookies, extensions, saved passwords)
bun "$SKILL_DIR/navigate.js" --url https://site.com --use-default-profile true

# Use specific Chrome profile directory
bun "$SKILL_DIR/navigate.js" --url https://site.com --profile "/path/to/chrome/profile"
```

**[!] Important**: Chrome must be fully closed when using its profile (single instance lock).

**Profile paths by OS:**
- **macOS**: `~/Library/Application Support/Google/Chrome`
- **Windows**: `%LOCALAPPDATA%/Google/Chrome/User Data`
- **Linux**: `~/.config/google-chrome`

### Method 4: Connect to Running Chrome

Best for debugging (can see browser window while scripts run):

```bash
# Step 1: Launch Chrome with remote debugging (in separate terminal)
# macOS:
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222

# Windows:
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222

# Linux:
google-chrome --remote-debugging-port=9222

# Step 2: Log in manually in the Chrome window

# Step 3: Connect and automate
bun "$SKILL_DIR/connect-chrome.js" --browser-url http://localhost:9222 --url https://site.com

# Or launch Chrome automatically (opens new window):
bun "$SKILL_DIR/connect-chrome.js" --launch --port 9222 --url https://site.com
```

### Method 5: Interactive Login (OAuth/SSO)

Best for OAuth, SSO, or any login requiring manual interaction in the browser:

```bash
# Open browser at login page, wait for redirect to dashboard after OAuth
bun "$SKILL_DIR/navigate.js" --url https://app.example.com/login \
  --wait-for-login "/dashboard"

# With longer timeout (10 min) for slow SSO providers
bun "$SKILL_DIR/navigate.js" --url https://app.example.com/login \
  --wait-for-login "/dashboard" --login-timeout 600000

# Use regex for complex URL patterns
bun "$SKILL_DIR/navigate.js" --url https://app.example.com/login \
  --wait-for-login "/(dashboard|home|app)"
```

**How it works:**
1. Opens browser in **headed mode** (always, regardless of OS)
2. Navigates to the login URL
3. Waits for you to complete the login flow manually (OAuth, 2FA, etc.)
4. Detects success when URL matches the regex pattern
5. Saves all cookies to `.auth-session.json` for 24-hour reuse
6. Subsequent scripts reuse the authenticated session automatically

### Session Persistence

Auth sessions are saved to `.auth-session.json` for 24-hour reuse:

```bash
# First script injects auth
bun "$SKILL_DIR/inject-auth.js" --url https://site.com --cookies '[...]'

# Subsequent scripts reuse saved auth automatically
bun "$SKILL_DIR/navigate.js" --url https://site.com/dashboard
bun "$SKILL_DIR/screenshot.js" --url https://site.com/profile --output ./profile.png

# Clear auth session when done
bun "$SKILL_DIR/inject-auth.js" --url https://site.com --clear true
```

### Choosing the Right Method

| Method | Best For | Complexity |
|--------|----------|------------|
| Inject cookies | Simple session cookies, API tokens | Low |
| Import from extension | Multi-cookie auth, OAuth tokens | Medium |
| Chrome profile | 2FA, SSO, complex OAuth flows | Low* |
| Connect to Chrome | Debugging, visual verification | Medium |
| Interactive login | OAuth/SSO with manual browser interaction | Low |

*Requires Chrome to be closed first

## Reference Documentation

- `./references/cdp-domains.md` - Chrome DevTools Protocol domains
- `./references/puppeteer-reference.md` - Puppeteer API patterns
- `./references/performance-guide.md` - Core Web Vitals optimization
- `./scripts/README.md` - Detailed script options
