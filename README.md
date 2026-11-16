# dsh-subagent-pool Plugin

## Overview

Plugin for DeepSeek Harness that manages a pool of subagent slots with:
- Concurrent cap enforcement (totalCap, per-route cap)
- Route-based model allocation (provider/model/cap/thinking)
- Queue-based waiting at capacity
- Settings UI integration (Plugins tab + Agent Presets tab)

## Quick Install

```bash
# From GitHub (main branch)
dsh plugin add github:crstalli/subagent-pool

# Or specific commit
dsh plugin add github:crstalli/subagent-pool#dce0c32
```

## Features

### Settings Integration
- **Settings → Plugins tab**: Subagent Pool card with live status
- **Settings → Agent Presets tab**: Model types, caps, thinking levels
- **Settings → Built-in plugins tab**: Also shows Subagent Pool

### Pool API
| Endpoint | Description |
|----------|-------------|
| `GET /subagent-pool/status` | Pool state (enabled, routes, running count) |
| `GET /subagent-pool/models` | Available models per provider |
| `POST /subagent-pool/sync-model-selection` | **Sync session policy** (see below) |
| `POST /subagent-pool/configure` | Edit pool config (Settings GUI) |

### Sync Model Selection (NEW)
**POST** `/subagent-pool/sync-model-selection`
```json
{ "sessionId": "<your-session-id>" }
```
This appends a model selection policy event to an **existing session**, making newly added pool models immediately available without requiring a new session.

### Configuration
Pool config lives at `subagent_pool_config.json` alongside this plugin:
- `totalCap`: Max concurrent subagents (sum if auto)
- `totalCapAuto`: Auto cap = sum of route caps
- `routes`: Array of `{provider, model, cap, tier, maxThinking, profile}`
- `queueMaxWaitSec`, `queueMaxLen`

## Supported Models (Commit dce0c32)

| Provider | Model | Cap | Tier |
|----------|-------|-----|------|
| nvidia | nvidia/nemotron-3.5-lightning-30b-a3b | 1 | deep |
| nvidia | google/gemma-4-31b-it | 1 | easy |
| nvidia | meta/muse-glimmer-30b | 1 | - |
| nvidia | nvidia/nemotron-3.5-super-vl-120b-a12b | 1 | - |

## Notes

- Pool uses NVIDIA provider configured in Settings → Agent Presets → Model selection
- Sync endpoint solves the "existing sessions don't see new models" problem
- Each session captures its policy at creation; use sync to refresh
- See `docs/SYNC-MODEL-SELECTION.md` for full details

## License

MIT