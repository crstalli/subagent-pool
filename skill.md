# subagent-pool-e2e

## Purpose
Playwright E2E testing for the subagent-pool Cordis plugin in a separate DSH test profile.
Tests plugin activation, Settings UI, subagent routing, and queueing without affecting the main harness.

## Quick Start

The e2e.js script handles everything internally (server startup, auth, testing, cleanup):

```bash
cd /mnt/f/ai/plugins/pwtest/subagent-pool-e2e
node test/e2e.js 3083
```

To run on a different port:
```bash
node test/e2e.js 3084
```

**Prerequisites:**
- DSH `pwtest` profile at `~/.dsh/profiles/pwtest/`
- Stored auth secret in `~/.dsh/.credentials.yaml`
- Port 3083 (or chosen) free

## What It Tests

1. **DSH Test Profile**: Spins up a separate DSH instance using `pwtest` profile on port 3083
2. **Plugin Definition**: Uses Playwright to navigate to the GUI, locate cordis_define, define the subagent-pool plugin
3. **Approval**: Clicks the Allow button in the Cordis approval prompt
4. **Plugin Run**: Activates the plugin (run/update)
5. **Settings UI**: Navigates to Settings → checks for Subagent Pool section with ACTIVE badge, route rows, running count, queue status
6. **Reporting**: Takes screenshots, dumps settings body text, reports PASS/FAIL

## Profile Configuration

- Uses existing `~/.dsh/profiles/pwtest/` profile (dsh-base + dsh-web-app bundles)
- Port: configurable (default 3083)
- Settings: shares `~/.dsh/settings.yaml` with main harness

## Artifacts

- `test/e2e-screenshot.png` — UI screenshot after plugin activation
- `test/e2e-screenshot2.png` — additional settings page screenshot
- `test/e2e-error.png` — screenshot on failure
- `test/settings-body.txt` — full Settings page text for analysis
- `test/console-errors.txt` — browser console errors (if any)

## Dependencies

- playwright (^1.63.0)
- DSH >= 0.1.2-rc.1
- Node.js 24.x
