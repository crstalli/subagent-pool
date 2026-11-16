// Test: configure endpoint syncs model-selection-policy to all live sessions
// Run: node --test tests/test-sync-all-sessions.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

const PORT = 3199;
const TOKEN_WAIT_MS = 90000;

async function startDsh() {
  const proc = spawn('node', [
    '/mnt/f/nvm/versions/node/v24.19.0/bin/dsh', 'web',
    '--port', String(PORT), '--no-open'
  ], {
    cwd: '/home/cztl/.dsh/profiles/web',
    env: { ...process.env, DSH_PROFILE: 'web' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let token = null;
  const buf = [];
  proc.stdout.on('data', (d) => {
    buf.push(d.toString());
    const m = buf.join('').match(/token=([A-Za-z0-9_-]+)/);
    if (m) token = m[1];
  });
  // Wait for token or port
  const deadline = Date.now() + TOKEN_WAIT_MS;
  while (!token && Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 500));
  }
  return { proc, token: token || 'unknown' };
}

async function stopDsh(proc) {
  proc.kill('SIGTERM');
  await Promise.race([
    once(proc, 'exit'),
    new Promise(r => setTimeout(r, 5000))
  ]);
}

test('configure endpoint returns sync field with synced/skipped/errors counts', async (t) => {
  const { proc, token } = await startDsh();
  t.after(() => stopDsh(proc));

  // Wait for port to be ready
  const deadline = Date.now() + 90000;
  let ok = false;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/subagent-pool/status?token=${token}`);
      if (r.ok) { ok = true; break; }
    } catch (e) {}
    await new Promise(r => setTimeout(r, 1000));
  }
  assert.ok(ok, 'DSH should be up on port ' + PORT);

  // Call configure with a known config
  const config = {
    enabled: true,
    totalCap: 2,
    totalCapAuto: true,
    routes: [
      { provider: 'nvidia', model: 'google/gemma-4-31b-it', cap: 1, tier: 'easy', maxThinking: '', profile: {} },
      { provider: 'nvidia', model: 'deepseek-ai/deepseek-v4.1-flash', cap: 1, tier: '', maxThinking: '', profile: {} }
    ]
  };
  const b64 = Buffer.from(JSON.stringify(config)).toString('base64');
  const res = await fetch(`http://127.0.0.1:${PORT}/subagent-pool/configure?config=${encodeURIComponent(b64)}&token=${token}`);
  const body = await res.json();

  assert.equal(body.ok, true, 'configure should return ok:true');
  assert.ok(body.status, 'response should have status');
  assert.equal(body.status.routes.length, 2, 'should have 2 routes');
  assert.ok('sync' in body.status, 'status should include sync field');
  assert.equal(typeof body.status.sync.synced, 'number', 'sync.synced should be a number');
  assert.equal(typeof body.status.sync.skipped, 'number', 'sync.skipped should be a number');
  assert.equal(typeof body.status.sync.errors, 'number', 'sync.errors should be a number');
});

test('sync-model-selection endpoint requires sessionId', async (t) => {
  const { proc, token } = await startDsh();
  t.after(() => stopDsh(proc));

  const deadline = Date.now() + 90000;
  let ok = false;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/subagent-pool/status?token=${token}`);
      if (r.ok) { ok = true; break; }
    } catch (e) {}
    await new Promise(r => setTimeout(r, 1000));
  }
  assert.ok(ok, 'DSH should be up');

  // Missing sessionId
  const res1 = await fetch(`http://127.0.0.1:${PORT}/subagent-pool/sync-model-selection?token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}'
  });
  const body1 = await res1.json();
  assert.equal(body1.ok, false);
  assert.match(body1.error, /sessionId/);

  // Non-existent session
  const res2 = await fetch(`http://127.0.0.1:${PORT}/subagent-pool/sync-model-selection?token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: 'session-nonexistent-12345' })
  });
  const body2 = await res2.json();
  assert.equal(body2.ok, false);
  assert.match(body2.error, /not found/);
});
