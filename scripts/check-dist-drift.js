"use strict";

/**
 * check-dist-drift.js
 *
 * Fails when the `dist/` directory committed to git does not match what
 * `source/` currently compiles to. Cocos Creator loads `dist/` directly --
 * there is no build step on the consumer side -- so a `source/`-only commit
 * silently ships a stale compiled artifact (this has happened twice: PRs
 * #92 and #93 both edited source/tools/manage-debug.ts with no rebuilt
 * dist/, so issue #89's fix never took effect in the editor -- see #109).
 *
 * What it does:
 *   1. Confirms the TypeScript compiler is installed (missing node_modules
 *      is reported as a missing dependency, never as phantom drift).
 *   2. Runs the real build (`tsc`), which WRITES to dist/ in the working
 *      tree -- identical bytes on a clean tree, the real compiled output on
 *      a drifted one.
 *   3. Diffs the freshly-built dist/ against what git has committed. Any
 *      modified OR newly-created file under dist/ fails the check and is
 *      named explicitly.
 *
 * Usage:
 *   node scripts/check-dist-drift.js
 *   npm run check:dist
 *
 * Exit codes:
 *   0 - dist/ matches the current source/ build output, no drift.
 *   1 - drift detected, OR the build/environment itself is broken (the
 *       message says which).
 */

const path = require("path");
const { spawnSync } = require("child_process");

const REPO_ROOT = path.join(__dirname, "..");

function fail(message) {
    console.error(`\n✖ ${message}\n`);
    process.exit(1);
}

function run(cmd, args) {
    return spawnSync(cmd, args, {
        cwd: REPO_ROOT,
        encoding: "utf8"
    });
}

function main() {
    // 1. Confirm dependencies are installed before doing anything else --
    // a missing node_modules must be reported as THAT, never as drift.
    let tscBin;
    try {
        tscBin = require.resolve("typescript/bin/tsc");
    } catch (err) {
        fail(
            "Cannot find the TypeScript compiler (typescript/bin/tsc).\n" +
            "  Run `npm install` first -- this is a missing-dependency problem, not dist/ drift."
        );
        return;
    }

    // 2. Confirm this runs inside a git working tree -- the diff step below
    // is meaningless otherwise.
    const gitCheck = run("git", ["rev-parse", "--is-inside-work-tree"]);
    if (gitCheck.error || gitCheck.status !== 0 || gitCheck.stdout.trim() !== "true") {
        fail("Not inside a git working tree -- cannot check dist/ for drift.");
        return;
    }

    // 3. Run the real build. Invoke tsc via `node <bin>` rather than the
    // node_modules/.bin shim so this behaves identically on Windows and
    // POSIX without relying on a shell to resolve .cmd/.ps1 wrappers.
    console.log("[check-dist-drift] Building source/ -> dist/ via tsc ...");
    const build = run(process.execPath, [tscBin]);
    if (build.error || build.status !== 0) {
        if (build.stdout) console.error(build.stdout);
        if (build.stderr) console.error(build.stderr);
        fail("The build itself failed (tsc reported errors above) -- fix compilation errors first.");
        return;
    }

    // 4. Compare the freshly-built dist/ against what git has committed.
    // `git status --porcelain` catches BOTH modified tracked files and new
    // untracked files (e.g. dist output for a newly added source file) --
    // a plain `git diff` only sees the former.
    const status = run("git", ["status", "--porcelain", "--", "dist/"]);
    if (status.error || status.status !== 0) {
        fail("`git status` failed while checking dist/ for drift.");
        return;
    }

    const drifted = status.stdout
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

    if (drifted.length > 0) {
        console.error("\n✖ dist/ is out of date with source/. The following files differ:\n");
        for (const line of drifted) {
            console.error(`  ${line}`);
        }
        console.error(
            "\nRun `npm run build` and stage the updated dist/** files in the same commit as your source/** change.\n"
        );
        process.exit(1);
        return;
    }

    console.log("[check-dist-drift] ✓ dist/ matches the current source/ build output. No drift.");
    process.exit(0);
}

main();
