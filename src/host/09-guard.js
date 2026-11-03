    // Async guard: Promise<null | {kind:'deny',reason}>.
    function guardAsync(exec) {
      if (!enabled || !config) return Promise.resolve(null);
      const name = exec && exec.name;
      if (name === 'subagent' || name === 'subagent_fork') {
        const route = requestedRoute(exec && exec.arguments);
        const key = route.provider + '/' + route.model;
        const rcfg = findRoute(route);
        if (!rcfg) {
          return Promise.resolve({ kind: 'deny', reason: 'Subagent pool: ' + key + ' is not a configured route; use ' + listRoutes() + '.' });
        }
        const ed = effortDecision(route, rcfg, exec && exec.arguments);
        if (ed) return Promise.resolve(ed);
        const c = counts();
        const rc = c.byRoute[key] ? c.byRoute[key].running : 0;
        if (rc < rcfg.cap && c.totalRunning < config.totalCap) return Promise.resolve(null);
        return waitInQueue(route, key, exec && exec.signal, false);
      }
      if (name === 'workflow' || name === 'ralph') {
        const c = counts();
        if (c.totalRunning < config.totalCap) return Promise.resolve(null);
        return waitInQueue(defaultRoute(), 'total', exec && exec.signal, true);
      }
      return Promise.resolve(null);
    }

