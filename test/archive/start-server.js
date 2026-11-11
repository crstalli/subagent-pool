#!/usr/bin/env node
// Start a DSH test profile instance on a free port (default: 3083).
// Usage: node start-server.js [port]

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.argv[2]) || 3083;
const DSH_HOME = path.join(require('os').homedir(), '.dsh');
const PID_FILE = path.join(__dirname, '.server-pid');

// Start DSH test instance using pwtest profile
const dsh = spawn('dsh', [
  '--profile', 'pwtest',
  '--port', String(PORT),
  '--no-open'
], {
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: false,
  env: { ...process.env, DSH_HOME }
});

dsh.stdout.on('data', d => process.stdout.write(d));
dsh.stderr.on('data', d => process.stderr.write(d));

// Write PID
fs.writeFileSync(PID_FILE, String(dsh.pid));
console.log(`DSH test server starting on port ${PORT} (PID: ${dsh.pid})`);
