# Subagent-pool — requirements

**Repo:** `https://github.com/crstalli/subagent-pool`
**HEAD:** `ef765aad9f7334d0f34e264fcdf33f0d9d6dfe80`
("fix: config path in plugin directory, not parent")
**Live code:** `index.js` (host, 724 lines) + `dsh/client.js` (client).
**Stale/divergent copies (not the build target):** `src/host/*` +
`src/client/*` (concatenate byte-identically into `pool-host-v4.js` /
`pool-client-v5.js`), `import.json` (embeds byte-identical copies of the v4/v5
bundles), `subagent-pool-boot/` (a third divergent copy).
**Builder prompt:** `subagent-pool-PROMPT.md` (same directory).
**Frozen rules:** `DETAILED_SPEC.md` (wins on conflict), `PORTS.md`,
`AGENT-HANDOFF.md`, `PLUGIN_DEV_TEST_SPEC.md`.

## 0. The one thing to get right first

The live mechanism is a **pre-execute guard + in-memory queue + model-selection
steering**. It is **not** the lease model in
`~/workspace/dsh-subagent-pool/DESIGN.md`, `docs/POOL-DESIGN.md`, or
`DETAILED_SPEC.md` §10.3 / card 06 (checkout/checkin/TTL/reaper/`agentOptions`).
A repo-wide grep for lease/checkout/checkin/reaper/agentOptions returns zero
hits in the live code. **Live code governs; §10.3 and card 06 are stale and
pending replacement.** Do not build the lease model. Do not cite it as a
requirement.

## 1. Requirements — requirement → demo → expected observable → evidence

| # | Requirement (with code anchor) | Demo step | Expected observable | Evidence artifact |
|---|---|---|---|---|
| SP-1 | Export ESM Cordis plugin `name='subagent-pool'`, `inject=['webServer']`, `apply(ctx, config)` (`index.js:7-10`). Zero npm dependencies. `engines: dsh >=0.2.0` (`package.json`). | Install by SHA into a dev profile (§3 of the prompt); start Dsh. | Plugin loads; no dependency install; no load error. | Install command + SHA; Dsh startup log showing the plugin loaded. |
| SP-2 | Load `subagent_pool_config.json` from the plugin install directory at boot (`CONFIG_PATH = pathResolve(__dirname, 'subagent_pool_config.json')`, `index.js:15-17`; `boot()`, `index.js:423-433`). Invalid/missing/unparseable → inactive with `inactiveReason`. No file watcher; loaded once at boot. | Start Dsh on the dev profile; then (separate run) start with a deliberately broken config file and observe. | Valid config → ACTIVE, no `inactiveReason`. Broken config → INACTIVE with a reason shown in the card, guard off. | Screenshots of the card in both states; the broken config file. |
| SP-3 | Guard `tools/pre-execute` for `subagent`/`subagent_fork` (`index.js:322-353`, registered at `index.js:444`). Route = explicit `provider`/`model` args if present, else `defaultRoute()` (`index.js:200-209`). | D3–D7 in the prompt. | Spawns on configured routes are admitted or queued; nothing else is intercepted. | Screenshots + deny messages quoted verbatim. |
| SP-4 | Unconfigured route → immediate deny naming the configured routes. `reasoning_effort` above the route's `maxThinking` → deny (ladder `off/minimal/low/medium/high/xhigh/max`, `index.js:20,211-230`). Route cap 0 → deny ("disabled"). | D5 (arc, cap 0), D6 (unconfigured route), D7 (over-limit thinking). | Three distinct, immediate denies, each naming the reason. | The three deny messages, quoted verbatim, plus the card state at the time. |
| SP-5 | At capacity → wait in the in-memory queue (`waitInQueue`, `index.js:275`), not an instant deny. Admission on every lifecycle event + a 5 s sweep (`timer.interval(processQueue, 5000)`, `index.js:498-501`). Queue iteration skips blocked entries and admits later ones — **skip-blocked FIFO, not strict FIFO** (`index.js:242-271`). Admission is soft: no slot reservation; a queue-admitted entry resolves to `null` and the spawn proceeds asynchronously, the slot booked later by `agent/created`. | D4 (second spawn queues, then starts when the slot frees). | Queue panel shows 1 waiting with route + waiting seconds, incrementing; the queued subagent starts after the first finishes. | Screenshots of the queue panel before/during/after; the queued subagent's start. |
| SP-6 | `workflow`/`ralph`: total-cap only; at capacity they queue as `totalOnly` entries against `defaultRoute()` (`index.js:349-352`). | D8. | Workflow queues while the slot is full; it consumes no route slot. | Queue-panel screenshot showing the `totalOnly` entry. |
| SP-7 | Lifecycle accounting (`index.js:437-441`): `agent/created` → book as `idle` (`:167-171`); `agent/status` → update, re-books if unknown (`:173-179`); `agent/disposed` → delete (`:181-185`); `agent/error` → only wakes the queue. `counts()` counts **only `status === 'running'`** (`:152-165`). A subagent is recognised only by `session.header.origin === 'subagent'` (`:148-150`). Route attribution: `agent.options.provider/model`, else parent session's options via `agents.get(header.parentSession)`, else `defaultRoute()` (reads `agent-default-model` settings or `agentDefaultModel.currentSelection()`, final fallback `qwen_local/qwen38_27b_medium`, `:64-76`). | D3 (spawn → `Running: 1 / 1`), D4 (finish → queued entry starts). | `Running` counts match reality at every step: 0/1 idle, 1/1 while one runs, back to 0/1 when it finishes. A finished subagent is not still counted. | Before/after screenshots of the `Running` count. |
| SP-8 | Full-slot behaviour: queue, don't deny — wait up to `queueMaxWaitSec` (default 300), AbortSignal cancels, then deny with a timeout message naming the wait seconds. Queue full (`queueMaxLen`, default 20) → immediate deny ("queue is full… try another route or retry"). Timer service missing → immediate deny ("queueing unavailable"). Disabled/removed route while queued → entry rejected with a deny on the next `processQueue` pass (`index.js:247-253`). | D10 (timeout with `queueMaxWaitSec: 15` via JSON + restart). | Queued entry denied after ~15 s with the timeout message. | Timeout deny message quoted verbatim; the edited config file. |
| SP-9 | On disable/stop, `flushQueue` denies all waiters (`index.js:505`, `:654`). | D11. | Queued entry denied on disable; guard stops enforcing; namespace restored. | Flush deny message; card showing INACTIVE; spawn proceeding unguarded. |
| SP-10 | Model-selection steering while active: `applyNamespace()` does `settings.update('subagent-model-selection', {enabled:true, allowedModels: <config routes>})` (`index.js:406-411`). On disable/dispose, `restoreNamespace()` restores the value saved on first activation (or `{enabled:false, allowedModels:[]}`) (`:413-421`). Mid-session limitation: tool params are sampled once per session, so enabling mid-session affects only new top-level sessions (`docs/POOL-DESIGN.md` §2). | D12. | While active, the namespace value lists exactly the configured routes as `allowedModels`; when inactive it is restored. | The namespace value (or the system-prompt section) shown as evidence. |
| SP-11 | System-prompt section `subagent-pool`, order 1000, listing routes/caps/profiles/queue when active; empty string when inactive (`index.js:449-488`). | D12. | Section text present while active, absent while inactive. | The section text. |
| SP-12 | Serve `GET /subagent-pool/status`, `/models`, `/model-info`, `/configure` on the Dsh web server (`index.js:537, 547, 582, 621`). `configure` takes base64 JSON in `?config=`, validates, writes the file, hot-applies (`:621-660`). **No auth in plugin code** on any of the four endpoints — no cookie/token/origin check; the only `localhost` strings are URL-parse bases (`:587, :625`). Any auth would have to come from Dsh's `webServer` itself (unverified from this repo). | D9 (Save → status updates); curl the four endpoints from the dev machine. | Status/models/model-info return JSON; configure hot-applies with no restart; whether Dsh's webServer adds auth is reported as observed, not assumed. | `curl` outputs; before/after status screenshots. |
| SP-13 | Hot-reload, no restart: the configure handler writes the file, swaps `configState`/`enabled` in memory, applies/restores the model-selection namespace, and wakes/flushes the queue (`index.js:642-656`). No restart path exists. | D9. | Cap change applies within the 3 s poll; same Dsh process, same session. | Before/after screenshots; process/session identity evidence. |
| SP-14 | Persist config as pretty-printed JSON (`JSON.stringify(cfg, null, 2)`, `index.js:143-148`); queue state is intentionally volatile (in-memory only, lost on restart). | D9/D10. | On-disk JSON is pretty-printed and matches the saved state; a restart empties the queue. | The on-disk file before/after. |
| SP-15 | Settings card registered in **both** slots from `dsh/client.js:597-608`: `settings.plugin.item` (`id:'subagent-pool'`, `key:'subagent-model-selection'`, `order:10`) and `settings.agentPresets.configurable` (same id/key/order). Note the key is `subagent-model-selection`, **not** `subagent-pool` as the comment at `index.js:696-700` claims. | D1. | Card renders in Settings (and in the agent-presets surface). | Screenshots of both surfaces. |
| SP-16 | Card fields present (`dsh/client.js`): status header ACTIVE/INACTIVE badge + `Running: N / M` (`:296-330`); `inactiveReason` shown when present; per-route live rows — `provider/model`, `cap`, `running x/y`, `idle z`, `[tier]`, `max-thinking`, `good for / avoid / notes` (`:325-348`); queue panel — total waiting, max len, max wait seconds, per-entry route + waiting seconds (`:349-366`); form — Enabled checkbox (`:373`), Total cap number input `min:0` (`:376`), per-route editors — provider/model dropdowns from `/subagent-pool/models` when available else text inputs (`:397-443`), per-route cap `min:0` (`:444-452`), max-thinking select (efforts from `/subagent-pool/model-info` else static ladder, `:456-474`), profile selects/inputs (`:476-557`), + Add route (`:559`), per-route remove (✕), Save disabled while busy (`:560-566`). | D1, D2, D4, D9. | Every field renders with live values; route rows and queue panel update without a page reload. | Screenshots with vision verdicts per field group. |
| SP-17 | Poll `GET /subagent-pool/status` every 3 s (`setInterval(refresh, 3000)`, `dsh/client.js:206`); form seeded from status only while the form is empty, never clobbering in-progress edits (`:149-171`). Catalog loaded once at mount; per-route model-info fetched lazily. | D9 (edit a field, watch a poll cycle, confirm the edit is not clobbered). | In-progress edits survive poll cycles. | Screenshot mid-edit across a poll. |
| SP-18 | Save: `configure({enabled, totalCap, routes})` → `GET /subagent-pool/configure?config=<base64 JSON>` (`dsh/client.js:77-83`, `:183-201`). On `{ok:true}` the returned status replaces local status; on `{ok:false}` the host error string is shown under the form. No client-side validation beyond `capNum` (clamps non-numbers/negatives to 1, allows 0). | D9; plus deliberately Save an invalid config (e.g. total cap 0) and observe. | Valid Save applies; invalid Save shows the host's `invalid config: …` error under the form. | Screenshots of both outcomes; the error string quoted. |
| SP-19 | Config schema v3 (`validateConfig`, `index.js:78-114`). Server validation: `totalCap` positive integer ≥ 1; routes non-empty array; unique non-empty `provider`/`model`; route `cap` non-negative integer, 0 = disabled (cap 0 is new in the live port — v4 required cap ≥ 1, `src/host/05-config.js`); `queueMaxWaitSec` ≥ 1, `queueMaxLen` positive integer when present. `enabled` is not validated, only `=== true` checked at load (`:132-138`). `version` is **not** validated; `configure` always writes `version: 3` (`:633`). | D9 + the invalid-Save check in SP-18. | Server rejects what the schema rejects, with the `invalid config: …` message. | The rejection messages quoted. |
| SP-20 | No ports, no env vars, no autostart of its own (grep for `process.env` / `AUTOSTART` / `listen` is empty). It rides the Dsh web server. Zero npm dependencies. | — (verified by inspection + install). | Nothing listens on a second port; no env var is read. | Install log; the grep result. |

## 2. Shipped config — the decision the builder must surface

The shipped `subagent_pool_config.json` is:

```json
{ "version": 3, "enabled": true, "totalCap": 2,
  "queueMaxWaitSec": 300, "queueMaxLen": 20,
  "routes": [
    { "provider": "arc", "model": "qwen3.8-27b-k4_xl-thinking",
      "cap": 0, "tier": "deep", "maxThinking": "high" },
    { "provider": "bonzai-rtx", "model": "rtx-bonzi",
      "cap": 1, "tier": "deep", "maxThinking": "medium" } ] }
```

- **Effective capacity = min(totalCap 2, route caps 0+1) = 1 concurrent
  subagent.** The card must show `Running: N / 1`, and the demo must show it
  honestly — not `N / 2`.
- **The `arc` route (the B65/Qwen route) is disabled out of the box (cap 0).**
  The builder must either justify this in the report (why arc is
  intentionally disabled) or change the shipped default and report the change.
  Do not leave it unexplained.
- **The spelling is "bonzai", not "bonsai"** (provider `bonzai-rtx`, model
  `rtx-bonzi`). Report it; do not silently "fix" it in the config without
  noting it — the name is load-bearing for route matching.

## 3. What the UI does NOT have (missing fields — SP-F2/SP-F3 cover the fixes)

- `queueMaxWaitSec` and `queueMaxLen` have **no inputs**; they can only be
  changed by editing the JSON file — and a later Save overwrites them from
  in-memory state (see §4).
- No deny-reason display, no per-route queue breakdown beyond the queue
  panel, no way to inspect or cancel individual queued entries, no version
  field.
- No "Enable" button when inactive (the v5 client had one,
  `pool-client-v5.js:311-318`; the live client dropped it — only the Enabled
  checkbox + Save).
- **Poll/catalog errors are invisible:** `errVal` and `catalogErrVal` state
  exist but are never rendered (`dsh/client.js:87,92` are their only
  occurrences) — the live UI silently falls back to text inputs, unlike
  v5/`POOL-DESIGN.md` §6 which promised a red polling-failure banner.

## 4. Defects to fix (P1) or report (P2)

**P1 — must fix in this run, with before/after evidence each:**

| # | Defect | Fix |
|---|---|---|
| SP-F1 | **Client/server validation mismatch.** The UI allows states the server rejects — Total cap 0 (input `min:0`, `capNum` allows 0), empty routes array (remove all), duplicate provider/model, empty provider/model strings. All surface only after Save as the host's `invalid config: …` error. | Add client-side validation matching `validateConfig` (`index.js:78-114`): reject before Save with a field-level message, or surface the server error inline per field. Do not leave post-Save as the only feedback. |
| SP-F2 | **Queue fields have no UI, and Save destroys hand edits.** The UI never sends `queueMaxWaitSec`/`queueMaxLen`, and `configure` merges them from in-memory `configState` (`index.js:637-638`), not by re-reading the file — hand edits to those fields on disk are silently overwritten by the next Save, and there is no file watcher to pick them up. | Add queue-field inputs to the form, and make Save preserve them (send them, or re-read the file at Save). A Save must never silently discard a value the file holds. |
| SP-F3 | **Poll/catalog errors invisible** (§3). | Render the polling-failure banner the v5 client had (or an equivalent visible error) when `/subagent-pool/status` or the catalog fails. Silent fallback to text inputs is not acceptable. |
| SP-F4 | **Settings-namespace registration is unverified.** `index.js:710-714` calls `settings.update('subagent-pool', {enabled:false, totalCap:0, routes:[]})` on every inject with no `describe`/registration call — whether `update` on an unregistered namespace actually registers it (as the comment claims) is Dsh-runtime behaviour, unverified from the repo. The value written (`totalCap: 0`) also contradicts the pool's own validation, though it is a different store from the pool config. | Verify on the real Dsh that the card renders in both slots (D1). If it does not, add the proper registration call. Either way, report what the runtime actually does. |
| SP-F5 | **Shipped arc cap 0** (§2). | Justify or change; report the decision. |
| SP-F6 | **Stale docs and dead config.** (a) README queue defaults 120 s / 50 vs live 300 s / 20 (`index.js:38-45`, shipped config). (b) README example routes (`qwen_local/qwen38_27b_medium`, `ollama_local/gemma4_12b`) don't match the shipped config (`arc`/`bonzai-rtx`). (c) `docs/POOL-DESIGN.md` is stale in at least five places: §1/§4 say `tools.guard` (code uses `tools/pre-execute`); §3 "the guard only denies; it never queues" (v4 added the queue); §5 config path `/home/cztl/subagent_pool_config.json` and "cap ≥ 1" (live: plugin dir, cap 0 allowed); §6 describes a `settings.section` slot + `host.call` RPC + Enable button (live: slots + HTTP GET, no Enable button); §7 "Skipped by design: `timer`" (live uses `timer` for queue timeout + 5 s sweep). (d) `cordis.patch.yml` config block `{enabled:false, totalCap:0, routes:[]}` is **dead** — `apply(ctx, config)` (`index.js:10`) never references its second parameter; `totalCap: 0` would fail server validation anyway. (e) `import.json` (created 2026-10-13) ships the **older config with arc cap 1** and the old dynamic plugin — it is not an install path and must say so. (f) `scripts/build-pool.js` is **broken** (syntax error at line 31, stray `.filter(...)` after a `;` — `node --check` fails) and writes to a `dist/` that does not exist; the `src/*` → bundle build path is non-functional at HEAD. | Correct the docs (or mark the stale ones superseded, pointing at this file); remove the dead config block or wire it up; mark `import.json` as not-an-install-path; fix or remove `build-pool.js`. |
| SP-F7 | **State-changing GET.** `configure` is a GET with the whole config as base64 JSON in the `config` query param (`index.js:621-660`; client `dsh/client.js:77-83`). Malformed base64/JSON is silently swallowed to `{}` (`index.js:627-630`), which then merges over the current config. Config in a URL lands in server logs and browser history and is CSRF-able by construction (GET with side effects: writes the file, flips `enabled`, flushes the queue). | Change to POST with a JSON body (client + server together). If a Dsh-side constraint prevents POST, report the exact constraint and the exact risk, and leave the GET in place only with Chris's explicit acceptance — do not ship it silently. |
| SP-F8 | **No nested-deadlock guard.** `guardAsync` (`index.js:322-353`) never checks whether the caller is itself a subagent or a parent session. With effective capacity 1, a subagent holding the only slot that spawns a child on the same route queues the child until the 300 s timeout, then denies it — the parent is blocked on the child the whole time. | Detect caller-is-subagent + same-route + slot-held-by-caller and deny immediately with a message naming the deadlock. At minimum, demonstrate the deadlock (D-step: subagent spawns a child on its own route) and report the exact observed behaviour if the guard is not added. |

**P2 — report; fix only if small and safe, each with before/after evidence:**

| # | Defect |
|---|---|
| SP-P1 | **Soft admission race (documented, still present).** The guard admits on `counts()` but the slot is only booked later by `agent/created` (`index.js:167-171`); a burst of simultaneous delegations can all pass before any `created` event books. `src/host/01-header.js:7-9` and `docs/POOL-DESIGN.md` §3 admit this; the queue does not fix it because queue-admitted entries also resolve to `null` with no reservation (`index.js:256-270`). |
| SP-P2 | **Missed-dispose slot leak.** If `agent/disposed` never fires for a `running` entry, the slot is consumed forever (no timeout/eviction on tracked entries; `agent/error` only wakes the queue, `index.js:440-442`). Conversely `onStatus` re-books unknown ids (`index.js:176-177`), so a late status event can resurrect a disposed entry. |
| SP-P3 | **No backfill.** `tracked` starts empty (`index.js:30`); no `agents.list()` call exists anywhere — subagents already running at boot are uncounted (undercount by design, `docs/POOL-DESIGN.md` §7). Likewise no boot-time backfill of `idle`→`running` transitions: an agent booked as `idle` on `created` consumes no slot until a `status` event says `running`; if that event never comes (or uses a different status string — Dsh's status vocabulary is not defined in this repo), the subagent runs uncounted indefinitely. |
| SP-P4 | **Inject-ordering fragility.** `registerEffects()` (`index.js:436-508`) reads `systemPrompt` and `timer` synchronously at `apply()` time, but those refs are only populated by `ctx.inject` callbacks (`index.js:668-688`) — if the callbacks haven't fired yet, the system-prompt section and the 5 s queue sweep are silently skipped forever (no retry). Likewise `boot()` → `applyNamespace()` reads `settings` at boot time; if `settings` isn't injected yet, the model-selection steering is skipped until the next configure call. Whether Cordis fires these inject callbacks synchronously during `apply()` is runtime-dependent and unverified from the repo. |
| SP-P5 | **Route-removal race in the queue.** `processQueue` (`index.js:247-253`) denies queued entries whose route was disabled/removed, including `totalOnly` workflow/ralph entries whose *default* route is disabled — so disabling the default route silently denies queued workflows even though they never use a route slot. |
| SP-P6 | **Validation gaps.** `validateConfig` doesn't check `version`, `tier`, or `enabled`'s type; `loadConfig` treats any non-`true` `enabled` as disabled with no distinction between "disabled" and "malformed". |
| SP-P7 | **Dead code.** `readBody` (`index.js:518-533`) never called (all endpoints are GET); `poolSchema` + `poolSchema.toJSON` (`index.js:702-704`) never referenced (the `settings.update(NS_POOL, …)` at `index.js:710` doesn't pass a schema, despite the comment at `index.js:696-700` claiming `describe()` needs it); `num()` (`dsh/client.js:38`), `KEY` (`:11`), `ROUTE` (`:12`) never used. |
| SP-P8 | **`node_modules/` (189 files, incl. Playwright) is tracked in git** despite `.gitignore` listing `node_modules/`. |
| SP-P9 | **Divergent stale copies.** `pool-host-v4.js` / `src/host/*` / `import.json`'s embedded host: dynamic plugin (`return {apply(ctx)}`, `ctx.get('harness')`, `harness.handle('pool.status|models|modelInfo|configure')`, hardcoded config path `/mnt/f/ai/plugins/subagent_pool_config.json`, fs via Dsh `fs` service, cap ≥ 1 validation, `settings.get()` for prev selection). `pool-client-v5.js` / `src/client/*` / `import.json`'s embedded client: `host.call('pool.*')` RPC, `ctx.interval` polling, `--dsw-alias-*` theme tokens, `THINKING_OPTS ['none','low','medium','high']`, Enable button, poll-error banner. `subagent-pool-boot/`: third copy — name `@local/subagent-pool-boot` / `subagent-pool-boot`, hardcoded `/mnt/f/ai/plugins/subagent_pool_config.json`, `settings.get` prev-selection, **no** `subagent-pool` namespace registration block, client registers only `settings.plugin.item` at order 30 with key `subagent-pool-boot` via direct `slots.register` (not the generator `inject`), own `cordis.patch.yml` with no `config` block. The live code is `index.js` + `dsh/client.js` only. |

## 5. Code-vs-spec conflicts (flagged, not silently resolved)

1. **Lease model vs live code.** `DETAILED_SPEC.md` §10.3 and card 06 describe
   checkout/checkin/TTL/reaper/`agentOptions`. The live code has none of it.
   **Live code governs; §10.3 needs replacement.** (Also: `DETAILED_SPEC.md`
   §14 unit tests list "lease claim/expiry/reaper" — that tests the hub-side
   lease API surface, not this plugin's enforcement.)
2. **README queue defaults** 120 s / 50 vs live 300 s / 20.
3. **README example routes** vs shipped config.
4. **`docs/POOL-DESIGN.md`** stale in five places (SP-F6c).
5. **Dead `cordis.patch.yml` config block** (SP-F6d).
6. **Settings key mismatch:** comment at `index.js:696-700` says the key is
   `subagent-pool`; the code uses `subagent-model-selection`.
7. **`import.json` ships the old config (arc cap 1)** and the old dynamic
   plugin; it is not an install path.
8. **`engines: dsh >=0.2.0`** vs the Dsh version on Chris's machine (core
   versions aligned at 0.1.2-rc.1 as of 2026-11-06) — verify at install time
   whether Dsh enforces it; a refusal or warning is a finding, not a thing
   to bypass.
9. **SHA install form undocumented** — the repo documents only the unpinned
   `github:crstalli/subagent-pool` form. Whether `dsh plugin add
   github:crstalli/subagent-pool#<sha>` is accepted needs a Dsh-side check;
   the prompt instructs the SHA form per the frozen rules and requires the
   exact error to be reported if it is rejected.
10. **"Enable button" claimed by v5 / POOL-DESIGN §6, absent in the live
    client** (§3).
11. **Client allows invalid states the server rejects** (SP-F1) — the only
    feedback is a post-Save host error.
12. **Queue fields have no UI; Save overwrites hand edits** (SP-F2).
13. **No auth on `/subagent-pool/*` in plugin code** (SP-12) — whether Dsh's
    `webServer` adds any is unverified from this repo; report as observed.

## 6. Unverified (do not guess)

- Whether `dsh plugin add github:crstalli/subagent-pool#<sha>` is accepted
  by Dsh (no SHA syntax anywhere in the repo).
- Whether the `dsh.client` manifest + exports map actually loads
  `dsh/client.js` in Dsh 0.2/0.3, and whether `settings.update` on the
  unregistered `subagent-pool` namespace registers it as the comment claims.
- Whether Dsh's `webServer` provides any authentication for
  `/subagent-pool/*` (plugin code has none).
- Cordis `ctx.inject` callback timing (relevant to SP-P4) and the exact
  `agent/status` vocabulary (only `'running'` counts).
- Test coverage: `test/e2e.js` (344 lines) + `test/playwright/e2e-check.mjs`
  (67 lines) exercise the Settings UI via a separate `pwtest` profile
  (ACTIVE badge, route rows, running count, queue status); **no assertions
  cover guard denies, queue admission, or the race/deadlock cases** — the
  demo in the prompt (D3–D11) is the first coverage of the enforcement
  behaviour, and it must be real (live spawns), not scripted UI clicks alone.

## 7. What the builder must NOT do

- Do not build the lease model from `DESIGN.md` / `POOL-DESIGN.md` / §10.3.
- Do not install into the `web` profile or touch port 3080.
- Do not install from `import.json`, `src/*`, `pool-host-v4.js`,
  `pool-client-v5.js`, or `subagent-pool-boot/`.
- Do not invent routes, models, caps, env vars, or ports. There are no env
  vars and no ports in this plugin.
- Do not claim a demo passed from logs alone. No screenshot + vision verdict
  = not demonstrated.
- Do not tear down the dev profile.
