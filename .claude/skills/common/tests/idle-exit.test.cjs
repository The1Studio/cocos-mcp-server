/**
 * Unit tests for the shared idle-exit helper (no real timers, no sleeps).
 * Run: node --test .claude/skills/common/tests/idle-exit.test.cjs
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');

const { watchIdle, resolveIdleMinutes, DEFAULT_IDLE_MINUTES } = require('../idle-exit.cjs');

/** Fake clock: setTimeout registers a timer; advance(ms) fires due timers in order. */
function fakeTimers() {
  let now = 0;
  let nextId = 1;
  const timers = new Map();
  return {
    setTimeout(fn, ms) {
      const id = nextId++;
      timers.set(id, { fn, due: now + ms });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    advance(ms) {
      now += ms;
      for (const [id, t] of [...timers.entries()].sort((a, b) => a[1].due - b[1].due)) {
        if (t.due <= now && timers.has(id)) {
          timers.delete(id);
          t.fn();
        }
      }
    },
    pendingCount() {
      return timers.size;
    },
  };
}

const MIN = 60 * 1000;

test('fires onIdle once after idleMinutes with no requests', () => {
  const clock = fakeTimers();
  const server = new EventEmitter();
  let fired = 0;
  watchIdle(server, { idleMinutes: 2, onIdle: () => fired++, timers: clock });

  clock.advance(2 * MIN - 1);
  assert.equal(fired, 0, 'must not fire before the window elapses');
  clock.advance(1);
  assert.equal(fired, 1, 'must fire at the window boundary');
  clock.advance(10 * MIN);
  assert.equal(fired, 1, 'must not fire twice');
});

test('every HTTP request re-arms the window', () => {
  const clock = fakeTimers();
  const server = new EventEmitter();
  let fired = 0;
  watchIdle(server, { idleMinutes: 2, onIdle: () => fired++, timers: clock });

  clock.advance(MIN + 30 * 1000);
  server.emit('request');
  clock.advance(MIN + 30 * 1000);
  assert.equal(fired, 0, 'a request 90 s in must keep the server alive past the first 120 s');
  clock.advance(30 * 1000);
  assert.equal(fired, 1, 'fires 2 min after the last request');
});

test('idleMinutes 0 disables the exit entirely', () => {
  const clock = fakeTimers();
  const server = new EventEmitter();
  let fired = 0;
  watchIdle(server, { idleMinutes: 0, onIdle: () => fired++, timers: clock });

  clock.advance(1000 * MIN);
  assert.equal(fired, 0);
  assert.equal(clock.pendingCount(), 0, 'no timer may be armed when disabled');
});

test('server close cancels the pending timer', () => {
  const clock = fakeTimers();
  const server = new EventEmitter();
  let fired = 0;
  watchIdle(server, { idleMinutes: 1, onIdle: () => fired++, timers: clock });

  server.emit('close');
  clock.advance(5 * MIN);
  assert.equal(fired, 0, 'a closed server must not fire onIdle');
  assert.equal(clock.pendingCount(), 0);
});

test('resolveIdleMinutes: default is 30 minutes', () => {
  assert.equal(DEFAULT_IDLE_MINUTES, 30);
  assert.equal(resolveIdleMinutes(undefined, {}), 30);
});

test('resolveIdleMinutes: env overrides default, flag overrides env', () => {
  assert.equal(resolveIdleMinutes(undefined, { T1K_SERVER_IDLE_MINUTES: '5' }), 5);
  assert.equal(resolveIdleMinutes('7', { T1K_SERVER_IDLE_MINUTES: '5' }), 7);
  assert.equal(resolveIdleMinutes('0.5', {}), 0.5);
  assert.equal(resolveIdleMinutes('0', {}), 0, '0 is a valid explicit disable');
});

test('resolveIdleMinutes: invalid input throws instead of falling back silently', () => {
  assert.throws(() => resolveIdleMinutes('abc', {}), /idle timeout/);
  assert.throws(() => resolveIdleMinutes('-1', {}), /idle timeout/);
  assert.throws(() => resolveIdleMinutes(undefined, { T1K_SERVER_IDLE_MINUTES: 'soon' }), /idle timeout/);
});
