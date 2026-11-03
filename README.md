# dsh-subagent-pool

Cordis plugin for DeepSeek Harness that manages concurrent subagents per model, routes tasks to the right model, queues at capacity, and exposes a Settings card in the Web GUI.

## Installation

### From GitHub

```bash
dsh plugin --profile web add github:crstalli/subagent-pool
```

If pnpm asks to allow the build script, add this to your profile's `pnpm-workspace.yaml`:

```yaml
allowBuilds:
  dsh-subagent-pool: true
```

Then restart `dsh web`.

### From local directory

```bash
dsh plugin --profile web add /path/to/dsh-subagent-pool
```

## Features

- **Per-model capacity**: Set caps on concurrent subagents per model/provider
- **Route-based distribution**: Route tasks to different models based on tier (deep/easy)
- **Queue management**: Queue requests at capacity with configurable max wait and max queue length
- **Settings card**: Configure pool via Settings > Plugins > Subagent Pool section
- **Config file**: Persistent configuration via `subagent_pool_config.json`

## Configuration

Pool settings are stored in `subagent_pool_config.json`:

```json
{
  "enabled": true,
  "totalCap": 2,
  "routes": [
    { "provider": "qwen_local", "model": "qwen38_27b_medium", "cap": 1, "tier": "deep" },
    { "provider": "ollama_local", "model": "gemma4_12b", "cap": 1, "tier": "easy" }
  ],
  "queueMaxWaitSec": 120,
  "queueMaxLen": 50
}
```

### Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable/disable the pool |
| `totalCap` | number | `2` | Maximum total concurrent subagents |
| `routes` | array | see above | Route definitions per model |
| `queueMaxWaitSec` | number | `120` | Max seconds a request waits in queue |
| `queueMaxLen` | number | `50` | Maximum queue length |

### Route Fields

| Field | Type | Description |
|-------|------|-------------|
| `provider` | string | Provider key (e.g., `qwen_local`, `ollama_local`) |
| `model` | string | Model identifier |
| `cap` | number | Concurrent subagent cap for this route |
| `tier` | string | Task tier (`deep` or `easy`) |
| `maxThinking` | string | Max thinking level (optional) |
| `profile` | object | Per-route profile settings (optional) |

## Usage

1. Open Settings > Plugins > Subagent Pool
2. Configure routes, caps, and queue settings
3. Click Save
4. The pool starts managing subagents automatically

## Architecture

- **Host half** (`index.js`): Manages subagent lifecycle, routing, queuing, and config I/O. Registered via `cordis.patch.yml`.
- **Client half** (`dsh/client.js`): Renders the Settings card UI. Loaded automatically by `cordis-client-runner` via the `dsh.client` manifest.
- **Config**: Persisted to `subagent_pool_config.json` in the plugin directory.

## License

MIT
