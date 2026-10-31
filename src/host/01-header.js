// Subagent Pool — host half v4 (pkg-4).
// vs v3: replaces the instant at-capacity deny with an in-process FIFO
// queue: at-capacity subagent/workflow/ralph calls WAIT for a free slot
// (event-driven wake on agent lifecycle events + 5s sweep), with a
// per-entry wait timeout (config queueMaxWaitSec, default 300) and
// AbortSignal cancellation (exec.signal). Queue cap (queueMaxLen,
// default 20) — beyond it, deny. No hard slot reservations: admission
// is soft, a documented race window remains. Config v3 adds optional
// queueMaxWaitSec / queueMaxLen; v1/v2 configs load unchanged.
// Queue state lives in process memory only (lost on restart); config
// + profiles persist on the F drive.
