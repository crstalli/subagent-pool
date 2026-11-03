return {
  apply(ctx) {
    // ---- services (all optional; degrade gracefully) ----
    const fs = ctx.get('fs');
    const settings = ctx.get('settings');
    const agents = ctx.get('agents');
    const systemPrompt = ctx.get('systemPrompt');
    const agentDefaultModel = ctx.get('agentDefaultModel');
    const llm = ctx.get('llm');
    const timer = ctx.get('timer');
    // builtins are bare free vars in the sandbox (ctx is the apply param)
    const log = function (m) { try { console.log(m); } catch (e) {} };

    const CONFIG_PATH = '/mnt/f/ai/plugins/subagent_pool_config.json';
    const NS_SELECTION = 'subagent-model-selection';
    const NS_DEFAULT = 'agent-default-model';

    // Canonical thinking-effort ladder, escalation order (pi-ai vocabulary;
    // adapters advertise a subset of these ids). Unknown ids are never
    // ranked: comparisons only fire when both sides are on the ladder.
    const EFFORTS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'];
    function effortRank(id) {
      const i = EFFORTS.indexOf(id);
      return i; // -1 when unknown
    }

