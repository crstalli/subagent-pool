# Subagent-pool auto-sync — explicit build instructions

Hand this to the builder agent together with `subagent-pool-PROMPT.md`
and `subagent-pool-REQUIREMENTS.md`. It overrides any instruction in
those files that tells anyone to edit the config JSON by hand. If this
file and another doc disagree about the config, this file wins on the
config question only; DETAILED_SPEC still wins on everything else.

## 0. The problem in one paragraph

Today the pool's route list lives in `subagent_pool_config.json`, a
hand-maintained file. It drifts from the providers and models Dsh
actually has configured: a model added in Dsh doesn't appear in the
pool, a model removed from Dsh stays in the pool, and the only fix is
someone editing JSON. Chris will not edit JSON. The pool must
therefore sync itself with Dsh. The JSON stops being a list of
models and becomes a record of his choices about models.

## 1. The frozen rule

- **Dsh's provider/model registry is the source of truth** for which
  providers and models exist. The pool never invents this list.
- **The JSON stores only choices, never the list.** For each
  provider/model it stores: enabled/disabled, the cap (max concurrent
  subagents for that model), and queue settings. Nothing else.
- **No human ever edits the JSON.** Not Chris, not the agent. Any
  task, doc, or UI text that tells a user to edit
  `subagent_pool_config.json` is wrong. The settings UI is the only
  way choices change; sync is the only way the list changes.

## 2. Step 0 — verify what the live install actually writes

Before writing any sync code, resolve the open item from the
diagnosis: **which config file does the live Settings card actually
write?** The repo copy and the installed copy may differ. Prove it by
changing a cap in the live Settings UI and reading back which file
changed on disk (path, mtime, content). Report the path. Do not build
sync on top of a file you have not proven is the live one. If the
Settings card writes somewhere else, sync targets that file.

## 3. Step 1 — find the read API (discovery, do this first)

Find how Dsh exposes its configured providers and models to a plugin
at runtime. Search the Dsh source and the running instance for the
registry behind agent presets / model configuration / the settings
service — whatever Dsh itself uses as its list. Deliverable for this
step, before any sync code: **the exact call or context lookup, plus
a probe proving it returns the current provider/model list** (paste
the output). Rules for this step:

- Use the API Dsh already has. Do not invent a new registry, a new
  config file, or a new key scheme.
- The sync key for a provider/model is **whatever stable identifier
  Dsh itself uses** for it. Discover it; do not invent one.
- If no read API exists, STOP and report that exactly: what you
  searched, what you found, and the minimal hook you propose (e.g. an
  event or a read accessor). Do not build sync on a guessed API, and
  do not fall back to hand-maintaining the JSON.

## 4. Step 2 — sync semantics (implement exactly these)

Sync runs at: plugin activation (Dsh start), every time the settings
UI is opened, on any provider/model change event Dsh exposes, and
from a Refresh button in the UI. Prefer the change event; do not poll
on a timer unless no event exists, and if you poll, say so in the
summary and justify the interval.

On each sync, compare the Dsh registry with the stored choices:

1. **New provider/model in Dsh:** create a route entry with
   **cap 0 (disabled)**. A new model is never auto-enabled — the pool
   is an allowlist, and silently enabling a new model is a surprise.
   It appears in the settings UI as available-but-disabled until
   Chris enables it and sets a cap.
2. **Provider/model removed from Dsh:** mark the entry
   **unavailable**. Keep its cap and enabled flag exactly as they
   were. Exclude it from spawning. Show it greyed out in the UI with
   "unavailable in Dsh". Do not delete it: if the model comes back,
   its cap must come back with it.
3. **Renamed or re-keyed model:** treat as remove + add (rule 2 for
   the old key, rule 1 for the new key). Do not try to guess that a
   rename is the same model.
4. **Unchanged:** leave the stored choices untouched. Sync never
   overwrites a cap, never re-enables a disabled model, never resets
   queue settings.
5. **Enforcement is fail-closed.** The pre-execute guard consults the
   synced table, not the raw JSON. A model that is not in Dsh's
   registry, or is marked unavailable, is denied with a reason naming
   the model and the cause ("not configured in Dsh" / "unavailable").
   There is no path where an unknown model spawns because the JSON
   mentioned it.

## 5. Step 3 — the settings UI (what it must show and do)

- Render the **live synced list from Dsh**, not the JSON's list.
  Every row: provider, model, status (available / unavailable),
  enabled toggle, cap editor.
- Show sync status at the top: last sync time, counts (available /
  unavailable), and a **Refresh** button that re-runs sync on demand.
- Save writes **only the choices** (enabled, cap, queue settings)
  back to the config file. It never writes the model list.
- Never display the JSON file path as something to edit. Never show
  instructions to edit JSON. If the UI today shows a stale list from
  the JSON, that is a bug this work fixes.
- Fix the known UI gaps as part of this work: add the queue fields
  (max wait, max length) to the form so Save stops overwriting hand
  edits; make client-side validation match the server's (the server
  rejects caps for unknown models — the UI must not offer them).

## 6. Step 4 — config file contract and migration

- Schema: the JSON holds choices keyed by the Dsh stable identifier
  only. No model list, no provider list, no display names copied in.
- Server-side validation: reject any stored choice whose key is not
  in the current synced registry, and reject caps outside the valid
  range. This is the fix for the client/server validation mismatch —
  the server is the authority, and the UI must agree with it.
- Migration on first run after this change: import existing caps by
  matching stored keys against Dsh identifiers. Entries that match
  nothing are kept as unavailable (rule 2), not deleted, and logged
  with their keys so Chris can see what didn't match. Report the
  migration result (matched / unmatched counts) in the summary.

## 7. What the agent must NOT do

- Never tell Chris to edit the JSON. Never edit the JSON as the fix
  for a missing or wrong model. If the fix you are reaching for is a
  JSON edit, you are solving the wrong problem — the fix is sync.
- Never hardcode a provider or model list anywhere: not in code, not
  in the UI, not in a doc, not in a test fixture that pretends to be
  the registry. Test fixtures may simulate a registry; they must be
  labelled as fixtures and must not ship as the list.
- Never treat the JSON list as the available list in the guard, the
  UI, or a test. The synced registry is the available list.
- Never add a second source of truth. If you find yourself writing a
  list of models anywhere except the sync code that reads Dsh, stop.

## 8. Demo — prove sync works (ties to DETAILED_SPEC §14.1)

Run these in a dev profile, left up for Chris to inspect, with the
§14.1 evidence bundle plus a vision verdict (screenshot + what it
shows vs what the feature should show) for each visual step:

1. **Add:** add a model in Dsh (or a test provider with a test
   model). Open pool settings. The model appears as
   available-but-disabled, cap 0. No JSON was touched — prove it with
   the file's mtime/content before and after.
2. **Enable + enforce:** enable it in the UI, set cap 1. Spawn two
   subagents on it: the first runs, the second queues or is denied
   per the full-slot rule, with the reason visible.
3. **Remove:** remove the model from Dsh. Sync (Refresh or reopen
   settings). The entry is greyed out as unavailable, its cap
   unchanged, and spawning on it is denied with the reason.
4. **Re-add:** add the model back. Its previous cap is restored —
   it was never deleted.
5. **Restart:** restart Dsh. Sync re-runs on activation, caps
   persist, no manual step.
6. **No-JSON check:** at the end, state in the summary the number
   of times any human or agent edited the JSON by hand during the
   whole task. The number must be zero (migration import excepted,
   and that must be the code doing it, not a person).

## 9. Done criteria (all must hold)

- [ ] Step 0 done: the live config file path is proven, not assumed.
- [ ] Step 1 done: the read API is named with a probe proving it
      returns the registry. (Or: reported as not existing, with the
      proposed minimal hook — and no sync code built on a guess.)
- [ ] New models appear disabled (cap 0); removed models go
      unavailable with caps kept; re-added models restore caps.
- [ ] Settings UI renders the synced list with sync status and
      Refresh; Save writes choices only; queue fields present.
- [ ] Guard enforces from the synced table; unknown/unavailable
      models are denied with a named reason.
- [ ] Server validation rejects choices for unknown models; client
      validation matches it.
- [ ] Demo D1–D6 above all pass, with evidence bundle + vision
      verdicts, in a dev profile left running for inspection.
- [ ] Zero hand edits to the JSON by any human or agent in the task.
