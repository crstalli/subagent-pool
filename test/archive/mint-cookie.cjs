#!/usr/bin/env node
const fs = require('fs'), crypto = require('crypto');
const port = process.argv[2] || '3088';
const authority = '127.0.0.1:' + port;
const cred = fs.readFileSync('/home/cztl/.dsh/.credentials.yaml', 'utf8');
const stored = cred.match(/^\s*secret:\s*(\S+)\s*$/m)[1];
const b64u = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const secret = Buffer.from(stored.replace(/-/g, '+').replace(/_/g, '/'), 'base64'); // decoded key bytes
const now = Date.now();
const payload = { version: 1, authority, issuedAt: now, expiresAt: now + 86400000 };
const body = 'v1.' + b64u(Buffer.from(JSON.stringify(payload)));
const sig = b64u(crypto.createHmac('sha256', secret).update(body).digest());
console.log('dsh-auth-' + b64u(crypto.createHash('sha256').update(authority).digest()) + '=' + body + '.' + sig);
