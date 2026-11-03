// Subagent Pool — build tool.
//
// The canonical bundles pool-host-v4.js / pool-client-v5.js are built by
// concatenating the part files in src/host/ and src/client/ (numeric order).
// Parts are the source of truth for edits; the bundles are generated.
//
// Usage:
//   node build-pool.js            build: concatenate parts -> canonical bundles,
//                                 then `node --check` each output
//   node build-pool.js --check    verify: concatenation must be byte-identical
//                                 to the existing canonical bundles (exit 1 if not)
//   node build-pool.js --list     print the part order and line counts
//
// After any edit to src/**, run `node build-pool.js --check` first (dry run),
// then `node build-pool.js` to regenerate, and re-run the README §8 checklist.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const BUNDLES = [
  { parts: path.join(ROOT, 'src', 'host'), out: path.join(ROOT, 'dist', 'pool-host-v4.js') },
  { parts: path.join(ROOT, 'src', 'client'), out: path.join(ROOT, 'dist', 'pool-client-v5.js') },
];

function sha256(s) { return crypto.createHash('sha256').update(s).digest('hex'); }
function partFiles(dir) {
  const abs = path.resolve(dir); if (path.isAbsolute(dir) && dir === path.resolve(__dirname, '../src/host')) {} return fs.readdirSync(abs).filter(f => /^\d{2}-.*\.js$/.test(f)).sort().map(f => path.join(abs, f));
    .filter(f => /^\d{2}-.*\.js$/.test(f))
    .sort()
    .map(f => path.join(ROOT, dir, f));
}
function build(b) {
  let out = '';
  const rows = [];
  for (const f of partFiles(b.parts)) {
    const s = fs.readFileSync(f, 'utf8');
    out += s;
    rows.push([path.basename(f), s.split('\n').length]);
  }
  return { out, rows };
}

const mode = process.argv[2] || 'build';
if (mode === '--list') {
  for (const b of BUNDLES) {
    console.log('## ' + b.out);
    for (const [name, lines] of build(b).rows) console.log('  ' + name.padEnd(28) + String(lines).padStart(4) + ' lines');
  }
  process.exit(0);
}

let fail = 0;
for (const b of BUNDLES) {
  const { out, rows } = build(b);
  const outPath = path.join(ROOT, b.out);
  if (mode === '--check') {
    const cur = fs.readFileSync(outPath, 'utf8');
    const ok = cur === out;
    console.log((ok ? 'OK  ' : 'FAIL') + ' ' + b.out +
      ' (sha256 ' + sha256(out).slice(0, 12) + ' vs ' + sha256(cur).slice(0, 12) + ', ' + out.length + 'B)');
    if (!ok) fail = 1;
  } else {
    fs.writeFileSync(outPath, out);
    try {
      execFileSync(process.execPath, ['--check', outPath], { stdio: 'pipe' });
      console.log('OK  ' + b.out + ' written (' + out.length + 'B, ' + rows.length + ' parts, node --check passed, sha256 ' + sha256(out).slice(0, 12) + ')');
    } catch (e) {
      console.log('FAIL ' + b.out + ' node --check: ' + e.stderr.toString().split('\n').slice(0, 4).join(' '));
      fail = 1;
    }
  }
}
process.exit(fail);
