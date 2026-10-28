/**
 * Idle exit for detached HTTP servers (shared by markdown-novel-viewer and plans-kanban).
 *
 * Arms a timer when the server starts; every HTTP request re-arms it. When the window
 * elapses with no request, onIdle runs once. A window of 0 disables the exit.
 *
 * Shape follows theonekit-core scripts/t1k-app-manifest.cjs (one-shot idle exit);
 * this variant re-arms on activity because a viewer is used repeatedly.
 *
 * Configure: --idle-timeout <minutes> (flag wins) or T1K_SERVER_IDLE_MINUTES (env).
 * Default 30 minutes. Invalid values throw; they are never silently replaced.
 */

const DEFAULT_IDLE_MINUTES = 30;
const IDLE_ENV = 'T1K_SERVER_IDLE_MINUTES';
const MS_PER_MINUTE = 60 * 1000;

/**
 * @param {string|undefined} flagValue - raw value of --idle-timeout, if given
 * @param {Record<string, string|undefined>} env - environment (injectable for tests)
 * @returns {number} minutes, >= 0
 */
function resolveIdleMinutes(flagValue, env = process.env) {
  const raw = flagValue !== undefined ? flagValue : env[IDLE_ENV];
  if (raw === undefined || raw === '') return DEFAULT_IDLE_MINUTES;
  const minutes = Number(raw);
  if (!Number.isFinite(minutes) || minutes < 0) {
    throw new Error(`idle timeout must be a number of minutes >= 0 (got "${raw}")`);
  }
  return minutes;
}

/**
 * Arm the idle exit for an HTTP server.
 * @param {import('node:events').EventEmitter} server - emits 'request' and 'close'
 * @param {{ idleMinutes: number, onIdle: () => void, timers?: object }} options
 *   timers is injectable ({ setTimeout, clearTimeout }) so tests run on a fake clock.
 * @returns {{ touch: () => void, cancel: () => void }}
 */
function watchIdle(server, { idleMinutes, onIdle, timers = { setTimeout, clearTimeout } }) {
  const idleMs = idleMinutes * MS_PER_MINUTE;
  if (idleMs === 0) return { touch() {}, cancel() {} };

  let handle = null;
  const cancel = () => {
    if (handle !== null) {
      timers.clearTimeout(handle);
      handle = null;
    }
  };
  const touch = () => {
    cancel();
    handle = timers.setTimeout(() => {
      handle = null;
      onIdle();
    }, idleMs);
  };

  server.on('request', touch);
  server.on('close', cancel);
  touch();
  return { touch, cancel };
}

module.exports = { watchIdle, resolveIdleMinutes, DEFAULT_IDLE_MINUTES, IDLE_ENV };
