# Sync Model Selection Endpoint

## Problem
When you add a new model to the subagent pool (or update `allowedModels` in model-selection-settings), **existing sessions don't see it**. The model selection policy is captured at session creation and stored as a durable event.

## Solution: `/subagent-pool/sync-model-selection`

**POST** `http://<dsh-host>:<port>/subagent-pool/sync-model-selection`

```json
{
  "sessionId": "<your-session-id>"
}
```

This appends a new `subagent/model-selection-policy` event to the session with the **current pool routes**, making newly added models immediately available for subagent spawning in that session.

---

## Usage

### 1. Get your session ID
- From the URL: `http://localhost:3080/?sessionId=<id>&token=...`
- Or from the Sessions sidebar

### 2. Call the sync endpoint
```bash
curl -X POST http://localhost:3080/subagent-pool/sync-model-selection \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"session-abc123"}'
```

### 3. Response
```json
{
  "ok": true,
  "message": "Model selection synced",
  "allowedModels": [
    {"provider": "nvidia", "model": "nvidia/nemotron-3.5-lightning-30b-a3b"},
    {"provider": "nvidia", "model": "google/gemma-4-31b-it"},
    {"provider": "nvidia", "model": "meta/muse-glimmer-30b"},
    {"provider": "nvidia", "model": "nvidia/nemotron-3.5-super-vl-120b-a12b"}
  ]
}
```

### 4. Spawn subagent with new model
Now you can use any model in the pool:
```json
{
  "action": "subagent/start",
  "provider": "nvidia",
  "model": "google/gemma-4-31b-it",
  "task": "Your task here"
}
```

---

## When to Use

| Scenario | Action |
|----------|--------|
| Added new model to pool config | Sync existing sessions |
| Updated `allowedModels` in Settings | Sync existing sessions |
| Want to use a model not in session's original policy | Sync the session |
| New session created | No sync needed (picks up live config) |

---

## How It Works

1. Reads current pool config (`cs().routes` where `cap > 0`)
2. Gets the session from the sessions service
3. Appends `subagent/model-selection-policy` event with `allowedModels`
4. The subagent system's projection reads this event for future spawns

---

## For Agents (Subagents)

If you're a subagent and need to sync the parent session:
```javascript
// In your subagent code
await fetch('/subagent-pool/sync-model-selection', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ sessionId: parentSessionId })
});
```

The parent session ID is available in your session context as `session.subagent.address.parentSessionId`.