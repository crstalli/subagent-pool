# Subagent Pool — Design Notes

## 1. Mechanism mapping

| Requirement | Mechanism (pool-host.js) |
|---|---|
| Model selection | `subagent-model-selection` settings namespace: `allowedModels` = config routes, enabled only while the pool is active; gives new top-level sessions `provider`/`model` on the `subagent` tool |
| Caps (per-route + total) | `tools.guard` denial: `subagent`/`subagent_fork` check route membership + per-route cap + total cap; `workflow`/`ralph` check total cap only |
| Routing guidance | `systemPrompt.section('subagent-pool', order:1000)` gated text + guard denial reasons naming a free alternate route + this settings UI |
| Live counts | `agent/created` / `agent/status` / `agent/disposed` accounting into a `tracked` Map; leaf reads only (`options.{provider,model}`, `header.origin==='subagent'`) |
| UI | `settings.section` list slot (`subagent-pool`, order 25) + `host.call('pool.status' / 'pool.configure')` JSON RPC |

## 2. Mid-session sampling limitation

Model-selection params are sampled once per agent at install (`selectForAgent`, recorded in the `subagentModelSelectionPolicy` projection): an already-open session's tool schema is fixed, so enabling the pool mid-session does not add `provider`/`model` to the current session's `subagent` tool — only new top-level sessions pick up the enabled namespace. The guard and the accounting do not depend on tool params and work in every session.

## 3. Soft race window

Accounting is event-based: an agent enters `tracked` on `agent/created`, which fires after the guard decision for that call. Caps are the primary protection, but a burst of simultaneous delegations can all pass the guard before the earlier calls' created events are booked, momentarily exceeding a cap by the race window. The guard only denies; it never queues or delays.

## 4. Reversibility

All side effects are Fiber-scoped and disposed on stop/update/undefine: `ctx.on` listeners, `tools.guard(fn)`, and `systemPrompt.section` auto-dispose; `ctx.effect(...)` restores `subagent-model-selection` to the value saved on first activation (or `{enabled:false, allowedModels:[]}` when none was registered). The config file is owned data and persists; the next activation re-derives state from it at boot.

## 5. Config reference

`/home/cztl/subagent_pool_config.json`:

```json
{ "version": 1, "enabled": true, "totalCap": 2,
  "routes": [
    { "provider": "qwen_local", "model": "qwen38_27b_medium", "cap": 1, "tier": "deep" },
    { "provider": "ollama_local", "model": "gemma4_12b", "cap": 1, "tier": "easy" } ] }
```

`pool.configure({enabled?, totalCap?, routes?})` merges the patch over the current config (missing keys keep the current value), validates (totalCap ≥ 1 integer; routes non-empty; non-empty unique provider/model; cap ≥ 1), writes the file, and activates/restores the namespace. From an empty state (no loaded config) a full `routes` array is required to enable, because the base routes is `[]`.

## 6. UI

Settings > Subagent Pool (settings.section list slot, order 25). Polls `pool.status` every 3 s via the injected `timer` service (`ctx.interval` disposer as the React effect cleanup). Form seeding: from `status.routes` when non-empty, else built-in defaults (qwen3.8 deep / gemma4 easy, caps 1+1, totalCap 2); a non-empty form is never clobbered by a poll. Sections: title + ACTIVE/INACTIVE badge; active → "Running N / M" + per-route `running x/y · idle z` rows; inactive → `inactiveReason` + Enable button (sends `{enabled:true, totalCap, routes}` from the form); static routing guidance line; configure card (Enabled checkbox, Total cap, per-route cap inputs, Save). Polling failures show a red banner and keep the last good status; Save/Enable show the host's error string when `ok:false`; buttons disable while busy.

## 7. Skipped / risks (pool-host.js + impl-checkpoint.md)

- `systemPrompt.section` `order:1000` is a guessed relative placement; the rendered position versus other sections is unverified.
- Namespace restore is fire-and-forget (`settings.update(...).catch(log)`); a concurrent settings writer can race the restore; the previous value is captured once, on first activation only.
- `agents.get(header.parentSession)` assumes the header id is a live registry key; on miss/throw it falls back gracefully to the default route.
- `fs.resolve` on a missing path never throws (nearest existing ancestor + appended suffix), so `writeConfig` creates the file — but a typo'd `CONFIG_PATH` would silently write elsewhere; load's catch only covers read failures.
- `tracked` starts empty: subagents already running when the plugin activates are uncounted (undercount, never overcount); there is no `agents.list()` backfill at boot.
- Skipped by design (host): `timer` (enforcement is reactive — events + guard, no polling); `web`/`bash`/`goal`/`jobs`; `fs.stat`/`settings.replace|describe`.
