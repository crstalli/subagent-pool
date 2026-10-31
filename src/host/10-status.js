    // ---- status ----
    function routeView(r) {
      const c = counts();
      const k = r.provider + '/' + r.model;
      const x = c.byRoute[k] || { running: 0, idle: 0 };
      const v = {
        provider: r.provider, model: r.model, cap: r.cap,
        tier: r.tier,
        maxThinking: (typeof r.maxThinking === 'string') ? r.maxThinking : '',
        profile: null,
        running: x.running, idle: x.idle
      };
      if (r.profile && typeof r.profile === 'object') {
        v.profile = {
          thinking: r.profile.thinking || '',
          speed: r.profile.speed || '',
          instructions: r.profile.instructions || '',
          bestFor: r.profile.bestFor || '',
          avoidFor: r.profile.avoidFor || '',
          notes: r.profile.notes || ''
        };
      }
      return v;
    }
    function statusPayload() {
      const c = counts();
      const out = { enabled: enabled };
      if (config && Array.isArray(config.routes)) {
        out.totalCap = config.totalCap;
        out.totalRunning = c.totalRunning;
        out.routes = config.routes.map(routeView);
        out.queue = {
          total: queue.length,
          maxLen: queueMaxLen(),
          maxWaitSec: Math.round(queueMaxWaitMs() / 1000),
          perRoute: {},
          waiting: []
        };
        for (let i = 0; i < queue.length; i++) {
          const e = queue[i];
          const k = e.totalOnly ? 'total-cap' : e.key;
          out.queue.perRoute[k] = (out.queue.perRoute[k] || 0) + 1;
          out.queue.waiting.push({ id: e.id, route: k, waitingSec: Math.round((Date.now() - e.since) / 1000) });
        }
      }
      if (!enabled) out.inactiveReason = reason;
      return out;
    }

