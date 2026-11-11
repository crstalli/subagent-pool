# subagent-pool Playwright tests

All scripts drive the test GUI at http://127.0.0.1:3088 (profile `pwtest-audit2`).
They read the token URL from the server log passed as argv[2] (default /tmp/final11.log).

Run the test server first:
  ARC_API_KEY=abcd OLLAMA_API_KEY=test dsh --profile pwtest-audit2 --no-open > /tmp/final11.log 2>&1 &

- `routes-shot.cjs [log] [prefix]` — screenshots of the configured route cards (collapsed + expanded).
- `cards-theme2.cjs` — theme/token verification + route toggle save/restore e2e (needs /tmp/final10.log-era token; pass log via edit if server restarted).
- `autocap3.cjs` — totalCapAuto e2e: toggle auto, toggle routes, Save, assert /subagent-pool/status.
- `css-save.cjs` — legacy css-class save test.

Historical one-off probes/screenshots live in `archive/`.
