# Builder/test prompt — subagent-pool

**Project:** `subagent-pool` — the Dsh plugin that caps concurrent subagents per
provider/model route plus a global total, queues at capacity, steers model
selection, and renders a Settings card.

**Repo:** `https://github.com/crstalli/subagent-pool`
**HEAD inspected:** `ef765aad9f7334d0f34e264fcdf33f0d9d6dfe80`
("fix: config path in plugin directory, not parent")
**Live code:** `index.js` (host, 724 lines) + `dsh/client.js` (client).
**Requirements doc (read first, it governs this prompt):**
`~/workspace/dsh-coordination/project-prompts/subagent-pool-REQUIREMENTS.md`
**Frozen rules:** `~/workspace/dsh-coordination/DETAILED_SPEC.md` (wins on any
conflict), `~/workspace/dsh-coordination/PORTS.md` (only authority on ports),
`~/workspace/dsh-coordination/AGENT-HANDOFF.md`,
`~/workspace/dsh-podman/PLUGIN_DEV_TEST_SPEC.md` (§4 install-twice, §11 dev
lifecycle). No secrets in any file. No hardcoded ports. No invented env vars,
port numbers, or performance claims.

## 1. What this project is (from the code, not from the docs)

The live mechanism is **not** the lease model in `~/workspace/dsh-subagent-pool/DESIGN.md`
or `docs/POOL-DESIGN.md`. There is no lease, checkout, checkin, reaper, or
`agentOptions` anywhere in the repo. The live mechanism is three parts:

1. **Pre-execute guard** (`index.js:322-353`, registered on `tools/pre-execute`
   at `index.js:444`). `subagent`/`subagent_fork`: route = explicit
   `provider`/`model` args if present, else `defaultRoute()`; unconfigured
   route → immediate deny naming the configured routes; `reasoning_effort`
   above the route's `maxThinking` → deny (ladder
   `off/minimal/low/medium/high/xhigh/max`); route cap 0 → deny ("disabled");
   route or total cap reached → wait in an **in-memory, skip-blocked FIFO
   queue** (`waitInQueue`, `index.js:275`), not an instant deny.
   `workflow`/`ralph`: total-cap only, queue as `totalOnly` entries against
   `defaultRoute()`. All other tools pass through. Guard disabled entirely
   when the pool is inactive.
2. **Lifecycle-event accounting** (`index.js:437-441`). `agent/created` → book
   as `idle`; `agent/status` → update (re-books if unknown); `agent/disposed`
   → delete; `agent/error` → only wakes the queue. `counts()` counts **only
   `status === 'running'`** as consuming a slot. A subagent is recognised only
   by `session.header.origin === 'subagent'`.
3. **Model-selection steering.** While active, `applyNamespace()` sets
   `settings.update('subagent-model-selection', {enabled:true, allowedModels:
   <config routes>})`; on disable/dispose, `restoreNamespace()` restores the
   value saved on first activation. Plus a `systemPrompt` section
   (`subagent-pool`, order 1000) listing routes/caps/profiles/queue when active.

**Shipped config** (`subagent_pool_config.json`, in the plugin install
directory next to `index.js`): `version 3, enabled true, totalCap 2,
queueMaxWaitSec 300, queueMaxLen 20`, routes `arc / qwen3.8-27b-k4_xl-thinking`
**cap 0 (disabled)**, `bonzai-rtx / rtx-bonzi` (spelling "bonzai") **cap 1**.
**Effective capacity = min(totalCap 2, route caps 0+1) = 1 concurrent subagent.**
The `arc` route — the B65/Qwen route — is disabled out of the box. That is a
decision to surface, not a detail to skip (see §6, SP-F5).

**No ports, no env vars, no autostart of its own.** The plugin rides the Dsh
web server on the dev profile's port. There is nothing to autostart and no
bridge. Do not invent an env var or a port for it.

## 2. What to do

Three phases, in order. The demo (phase 2) is the deliverable that matters
most — Chris's complaint is that work is never demonstrated. Do not spend the
run on fixes at the expense of the demo.

**Phase 1 — fix the load-bearing defects** (REQUIREMENTS §4, items SP-F1–SP-F8).
Fix each one in the live code (`index.js` / `dsh/client.js` only — the
`src/*`, `pool-host-v4.js`, `pool-client-v5.js`, `import.json`, and
`subagent-pool-boot/` copies are stale/divergent and are **not** the build
target; do not edit them, do not install from them). Every fix gets a
before/after note in your report: file, lines, what changed, how you verified
it. If a P1 fix cannot be made (e.g. a Dsh-side constraint), do not work
around it silently — report the exact constraint and the exact observed
behaviour, and leave the defect open.

**Phase 2 — demonstrate every requirement** in the REQUIREMENTS §2 table, using
the demo steps in §4 below, on a dev profile (see §3).

**Phase 3 — return the evidence bundle** (§5). No claim without its artifact.

## 3. Dev lifecycle (mandatory — replaces any "tear down after test" instruction)

1. **Create a fresh dev profile** for this run:
   `dev-subagent-pool-<yyyymmdd>-<n>`. A real Dsh profile, not just running
   code locally.
2. **Install the plugin into that profile by full commit SHA** (never a
   branch, tag, or `latest`): `dsh plugin --profile <dev-profile> add
   github:crstalli/subagent-pool#<full-sha>`.
   **Known gap — verify at install time, do not assume:** no `#<sha>` syntax
   is documented anywhere in this repo; only the unpinned
   `github:crstalli/subagent-pool` form appears in the README. If Dsh rejects
   the SHA form, report the exact error verbatim and stop — do **not** fall
   back to the unpinned form. Also verify the `engines: dsh >=0.2.0`
   declaration against the Dsh version on the test machine and report the
   outcome (a refusal or warning is a finding, not a thing to bypass).
   Never install into the `web` profile. Never touch Chris's main Dsh
   (`web`, port 3080): never stop, restart, kill, or `pkill dsh` it; never
   edit `~/.dsh/profiles/web`. Testing only on per-session ports 3081–3099
   (never 3080). Assert the 3080 PID is unchanged at the end of the run.
3. **Start Dsh on the dev profile** and confirm the pool plugin loads:
   Settings card renders, status ACTIVE, `inactiveReason` absent.
4. **Verify** (phase 2 demo) and **demonstrate** (screenshots + verdicts).
5. **LEAVE IT UP for Chris to inspect.** Do not tear it down. Report the
   profile name, the port, the URL, and exactly how to reach it (which
   profile, which port, where the Settings card is, what to click to see the
   queue panel). Delete the profile **only** when Chris asks.
6. This dev/inspection profile is **different** from the formal install-twice
   verification (PLUGIN_DEV_TEST_SPEC §4: fresh throwaway containers,
   install-twice, discarded on exit). §4 verifies installability; §11 (this
   profile) is for demonstration and inspection. Do both. Do not conflate
   them: a passing §4 does not replace the demo, and the demo profile is not
   a §4 container.

## 4. Demonstration (perform all of these; each needs its own screenshot + verdict)

Work in the dev Dsh instance. Spawn subagents from a session in that instance
via the `subagent` tool (with explicit `provider`/`model` args where the step
says so). If the dev Dsh's UI offers no way to spawn a subagent from the
browser, say so explicitly with what you tried — do not fake the spawn, do not
infer it from logs, do not substitute a curl against the hub. Quote every
deny message verbatim.

- **D1 — Settings card renders.** Open Settings in the dev Dsh. The
  `subagent-pool` card appears (it is registered in both
  `settings.plugin.item` and `settings.agentPresets.configurable`,
  `dsh/client.js:597-608`). Screenshot: the card, with the ACTIVE badge and
  `Running: 0 / 1` visible. Vision verdict: what the card shows vs what §2 of
  the requirements doc says it must show.
- **D2 — Status is honest.** With no subagents running: badge ACTIVE,
  `Running: 0 / 1` (effective capacity 1, not 2 — the shipped totalCap is 2
  but the route caps sum to 1), both route rows visible with caps
  (`arc … cap 0`, `bonzai-rtx … cap 1`), queue panel empty (0 waiting).
- **D3 — A spawn consumes the slot.** Spawn a subagent on `bonzai-rtx /
  rtx-bonzi`. The card updates to `Running: 1 / 1` and the route row shows
  `running 1/1`. Screenshot before/after. The spawned subagent runs.
- **D4 — A second spawn queues.** While the D3 subagent is still running,
  spawn a second subagent on the same route. It does **not** start
  immediately and is **not** denied: the queue panel shows 1 waiting with its
  route and waiting seconds, incrementing. Screenshot of the queue panel.
  When the D3 subagent finishes, the queued one starts (queue admits it).
- **D5 — Disabled route denies immediately.** Spawn on `arc /
  qwen3.8-27b-k4_xl-thinking` (cap 0). Immediate deny naming the route as
  disabled. Quote the message verbatim.
- **D6 — Unconfigured route denies immediately.** Spawn with a provider/model
  pair that is not in the config. Immediate deny naming the configured
  routes. Quote the message verbatim.
- **D7 — Over-limit thinking denies.** Spawn on `bonzai-rtx` with a
  `reasoning_effort` above that route's `maxThinking` (`medium`). Immediate
  deny. Quote the message verbatim.
- **D8 — Workflow/ralph is total-cap only.** While the slot is full, invoke a
  `workflow` (or `ralph`) run. It queues as a `totalOnly` entry against the
  default route (it does not consume a route slot, and it does not bypass the
  total cap). Show the queue panel with the entry.
- **D9 — Save hot-applies, no restart.** In the Settings card, change the
  `bonzai-rtx` cap (e.g. 1 → 2, then back), press Save. The status updates
  within the 3 s poll with no Dsh restart (same process, same session, no
  reload). Show the before/after status and confirm the Dsh process did not
  restart. Confirm the change is persisted in `subagent_pool_config.json` on
  disk (pretty-printed JSON).
- **D10 — Queue timeout denies.** Edit `subagent_pool_config.json` on disk to
  `queueMaxWaitSec: 15` (there is no UI field for it — that is SP-F2), restart
  Dsh **on the same dev profile**, fill the slot, queue a second subagent.
  After ~15 s it is denied with a timeout message naming the wait seconds.
  Quote the message. Then restore `queueMaxWaitSec: 300`.
- **D11 — Disable flushes the queue.** With an entry queued, uncheck Enabled
  and Save. The queued entry is denied (flush), the guard stops enforcing
  (a spawn proceeds unguarded), and the model-selection namespace is restored
  to its pre-activation value. Re-enable afterwards and confirm ACTIVE
  returns.
- **D12 — Steering is visible.** While active, show the model-selection
  steering in effect: the `subagent-model-selection` namespace value lists
  exactly the configured routes as `allowedModels`, and the `systemPrompt`
  `subagent-pool` section (order 1000) lists routes/caps/queue state. Show
  the section text (or the settings value) as evidence. When inactive (D11),
  the section is empty.

## 5. Evidence bundle to return (§14.1 + vision verdict)

Return all seven §14.1 items, plus for **every** screenshot a vision-verdict
line: what the screenshot actually shows vs what the feature should show.
Attach the screenshots; do not describe them from memory.

1. **Commands run** (exact commands, profile, port, commit SHA installed).
2. **Files changed** (path + lines, before/after for each SP-F fix).
3. **Screenshots, each with a vision verdict** — D1 (card renders), D2
   (status), D3 before/after (slot consumed), D4 (queue panel with 1
   waiting), D9 before/after (hot-applied cap), D10 (timeout), D11
   (disabled/flushed). A blank, empty, or wrong render is a FAIL even if
   logs are clean. A screenshot that is a text placeholder in a `.png` is
   not a screenshot (the swarm repo's `takeScreenshot` helper does exactly
   this — do not repeat it). Real pixels only, inspected by vision.
4. **Deny messages quoted verbatim** (D5, D6, D7, D10, D11 flush).
5. **Config file contents** before and after D9/D10 (the on-disk JSON).
6. **Log excerpt** showing guard decisions if the plugin logs them; if it
   does not log guard decisions, say so — do not invent log lines.
7. **Verdict per requirement** (REQUIREMENTS §2 table): PASS / FAIL / NOT
   DEMONSTRATED, with the artifact that proves it. Anything NOT
   DEMONSTRATED is an open item, not a pass.
8. **Dev profile access block:** profile name, port, URL, how to reach the
   Settings card and the queue panel, and confirmation the 3080 PID is
   unchanged.

## 6. Pass/fail bar

- **PASS** only if: D1–D12 all demonstrated with screenshots + vision
  verdicts; every deny in D5–D7/D10/D11 happened with the message quoted;
  the queue appeared in D4/D8 and drained in D4; Save hot-applied in D9 with
  no restart; the dev profile is left up with its access block reported; the
  3080 PID is unchanged.
- **FAIL** if any of: the Settings card does not render (or renders blank);
  `Running` counts do not match reality (a running subagent uncounted, or a
  finished one still counted); a spawn that should queue is denied instantly
  or starts immediately; a spawn that should deny starts anyway; a deny
  message does not name the reason (route disabled / unconfigured /
  over-limit thinking / timeout); Save requires a restart or loses the queue
  fields; the dev profile was torn down; the 3080 PID changed.
- **A defect you found but did not fix** is reported as an open item with the
  exact file:line and observed behaviour — it is not a pass, and it is not
  hidden by a passing demo of something else.

## 7. Conflicts to resolve or report (do not silently pick a side)

- **Lease model vs live code.** `DETAILED_SPEC.md` §10.3 and card 06 describe
  checkout/checkin/TTL/reaper/`agentOptions`. The live code has none of that
  (guard + queue + steering). **Live code governs; the spec is stale.**
  REQUIREMENTS §5 lists the stale text. Do not build the lease model. Flag
  §10.3 as needing replacement in your report.
- **README vs code.** README queue defaults (120 s / 50) vs live (300 s /
  20); README example routes vs shipped config. Fix the docs (SP-F6).
- **Shipped arc cap 0.** Either justify it in the requirements doc's terms
  (arc intentionally disabled — say why) or change the shipped default and
  report the change. Do not leave a disabled B65 route unexplained.
- **SHA install form.** The repo never documents `#<sha>`; verify Dsh
  accepts it (§3 step 2). If it does not, that is a finding about the Dsh
  side, not a reason to install unpinned.
- **`engines: dsh >=0.2.0`.** Verify against the test machine's Dsh version
  and report the outcome.
- **GET configure.** State-changing GET with the whole config as base64 in
  the URL (logs, history, CSRF-able). SP-F7: change to POST, or report the
  constraint and the exact risk and leave it for Chris to accept explicitly.
- **import.json / stale copies.** `import.json` embeds the old dynamic plugin
  with the old config (arc cap 1). It is not an install path. Say so in the
  report; do not install from it.
- **Queue fields have no UI; Save overwrites hand edits.** SP-F2. Do not
  present the JSON file as the supported way to set them.

## 8. What NOT to do

- Do not build the lease model from `DESIGN.md` / `POOL-DESIGN.md` / §10.3.
- Do not touch the `web` profile, port 3080, or `~/.dsh/profiles/web`.
- Do not install from `import.json`, `src/*`, `pool-host-v4.js`,
  `pool-client-v5.js`, or `subagent-pool-boot/` — live code is `index.js` +
  `dsh/client.js` only.
- Do not invent routes, models, caps, env vars, or ports. The shipped routes
  are `arc / qwen3.8-27b-k4_xl-thinking` (cap 0) and `bonzai-rtx / rtx-bonzi`
  (cap 1). The spelling "bonzai" is the code's spelling — report it, do not
  silently "fix" it in the config without noting it.
- Do not claim a demo passed from logs alone. No screenshot + vision verdict
  = not demonstrated.
- Do not tear down the dev profile. Do not delete anything Chris has not
  asked to delete.
- Do not "fix" the soft-admission race, the missed-dispose leak, or the
  no-backfill undercount by changing what `counts()` counts without saying so:
  those are P2 items (REQUIREMENTS §4) — fix only if small and safe, and list
  each fix with before/after evidence.
