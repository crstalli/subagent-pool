#!/usr/bin/env node
// Stop the DSH test profile instance.
// Usage: node stop-server.js [port]

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PORT = parseInt(process.argv[2]) || 3083;

// Also kill any node process on our port
try {
  const pids = execSync(`lsof -ti :${PORT} 2>/dev/null || true`).toString().trim();
  if (pids) {
    execSync('kill -9 ' + pids);
    console.log(`Killed processes on port ${PORT}`);
  }
} catch (e) {}

// Kill by PID file too
try {
  const pid = parseInt(fs.readFileSync(path.join(__dirname, '.server-pid'), 'utf-8').trim());
  if (pid > 0) process.kill(pid, 'SIGTERM');
} catch (e) {}

try { fs.unlinkSync(path.join(__dirname, '.server-pid')); } catch (e) {}
