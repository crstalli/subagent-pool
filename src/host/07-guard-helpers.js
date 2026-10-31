    // ---- guard helpers (decision-shaped for the waterfall) ----
    function findRoute(route) {
      if (!config || !Array.isArray(config.routes)) return undefined;
      for (let i = 0; i < config.routes.length; i++) {
        const r = config.routes[i];
        if (r.provider === route.provider && r.model === route.model) return r;
      }
      return undefined;
    }
    function listRoutes() {
      if (!config || !Array.isArray(config.routes)) return 'none';
      return config.routes.map(function (r) { return r.provider + '/' + r.model; }).join(', ');
    }
    // The caller's explicit provider/model args (present only once
    // subagent-model-selection is enabled for new sessions); otherwise the
    // pool's default route, which mirrors what the runner resolves.
    function requestedRoute(args) {
      const a = (args && typeof args === 'object') ? args : {};
      if (typeof a.provider === 'string' && a.provider !== '' && typeof a.model === 'string' && a.model !== '') {
        return { provider: a.provider, model: a.model };
      }
      return defaultRoute();
    }
    // Max-thinking check for one subagent call. Returns a deny decision or null.
    // Only fires when the requested effort AND the route's cap are both
    // canonical ladder ids; unknown ids pass through to adapter validation.
    function effortDecision(route, routeCfg, args) {
      if (!routeCfg) return null;
      const mt = (typeof routeCfg.maxThinking === 'string') ? routeCfg.maxThinking : '';
      if (mt === '') return null;
      const a = (args && typeof args === 'object') ? args : {};
      const effort = (typeof a.reasoning_effort === 'string') ? a.reasoning_effort : '';
      if (effort === '') return null;
      const er = effortRank(effort);
      const mr = effortRank(mt);
      if (er === -1 || mr === -1) return null;
      if (er > mr) {
        return { kind: 'deny', reason: 'Subagent pool: ' + route.provider + '/' + route.model + ' caps thinking at "' + mt + '" (you requested "' + effort + '"). Retry with reasoning_effort at or below "' + mt + '", or pick another route.' };
      }
      return null;
    }

