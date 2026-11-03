    // ---- accounting ----
    function isSubagent(agent) {
      return !!(agent && agent.session && agent.session.header && agent.session.header.origin === 'subagent');
    }
    function routeFor(agent) {
      const o = (agent && agent.options) ? agent.options : {};
      if (o.provider && o.model) return { provider: o.provider, model: o.model };
      const hdr = (agent && agent.session && agent.session.header) ? agent.session.header : {};
      if (hdr.parentSession && agents) {
        try {
          const p = agents.get(hdr.parentSession);
          if (p && p.options && p.options.provider && p.options.model) return { provider: p.options.provider, model: p.options.model };
        } catch (e) {}
      }
      return defaultRoute();
    }
    function counts() {
      const byRoute = {};
      let totalRunning = 0;
      const vals = tracked.values();
      for (const info of vals) {
        const k = info.route.provider + '/' + info.route.model;
        if (!byRoute[k]) byRoute[k] = { running: 0, idle: 0 };
        if (info.status === 'running') { byRoute[k].running++; totalRunning++; }
        else byRoute[k].idle++;
      }
      return { byRoute: byRoute, totalRunning: totalRunning };
    }
    function onCreated(p) {
      const a = p && p.agent;
      if (!isSubagent(a) || !a.id || tracked.has(a.id)) return;
      tracked.set(a.id, { id: a.id, route: routeFor(a), status: 'idle' });
      processQueue();
    }
    function onStatus(p) {
      const a = p && p.agent;
      if (!isSubagent(a) || !a.id) return;
      const st = (p && p.status) || 'idle';
      if (tracked.has(a.id)) tracked.get(a.id).status = st;
      else tracked.set(a.id, { id: a.id, route: routeFor(a), status: st });
      processQueue();
    }
    function onDisposed(p) {
      const a = p && p.agent;
      if (a && a.id) tracked.delete(a.id);
      processQueue();
    }

