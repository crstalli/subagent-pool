return {
  inject: ['timer'],
  apply(ctx) {
    // Built-in fallback route set (used when the host has no loaded config).
    const DEFAULT_ROUTES = [
      { provider: 'qwen_local', model: 'qwen38_27b_medium', cap: 1, tier: 'deep' },
      { provider: 'ollama_local', model: 'gemma4_12b', cap: 1, tier: 'easy' },
    ];

    // Confirmed theme tokens only.
    const T = {
      text: 'var(--dsw-alias-label-primary)',
      muted: 'var(--dsw-alias-label-secondary)',
      border: 'var(--dsw-alias-border-l1)',
      card: 'var(--dsw-alias-bg-layer-1)',
      field: 'var(--dsw-alias-bg-layer-2)',
      brand: 'var(--dsw-alias-brand-primary)',
      ok: 'var(--dsw-alias-state-success-primary)',
      err: 'var(--dsw-alias-state-error-primary)',
    };

    const inputStyle = {
      background: T.field,
      border: '1px solid ' + T.border,
      borderRadius: 4,
      color: T.text,
      padding: '2px 6px',
      fontSize: 12,
      fontFamily: 'inherit',
    };
    const selectStyle = Object.assign({}, inputStyle);
    const btnStyle = {
      background: T.brand,
      color: 'var(--dsw-alias-bg-base)',
      border: 'none',
      borderRadius: 6,
      padding: '4px 12px',
      fontSize: 12,
      fontWeight: 600,
      cursor: 'pointer',
    };
    const smallMuted = { fontSize: 11, color: T.muted };

    const THINKING_OPTS = ['none', 'low', 'medium', 'high'];
    // Fallback options when pool.modelInfo cannot resolve the local provider.
    const EFFORT_LADDER = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'];
    const SPEED_OPTS = ['fast', 'medium', 'slow'];
    const INSTRUCTIONS_OPTS = ['high-level ok', 'moderate detail', 'very explicit required'];

    // in-flight modelInfo fetches, keyed by "provider/model" (apply scope
    // persists across renders, so this survives re-renders)
    const inflight = {};

