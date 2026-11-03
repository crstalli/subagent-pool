    // ---- register side effects (all reversible / auto-disposed) ----
    function registerEffects() {
      // accounting listeners: always registered; gating is on `enabled`
      ctx.on('agent/created', onCreated);
      ctx.on('agent/status', onStatus);
      ctx.on('agent/disposed', onDisposed);
      ctx.on('agent/error', function (p) {
        if (p && p.agent && p.agent.id) processQueue();
      });
      // cap + thinking guards: waterfall listener on the extensible
      // pre-execute pipeline. Deny by returning a decision WITHOUT calling
      // next(); allow by returning next(). Auto-disposed on stop/undefine.
      ctx.on('tools/pre-execute', function (exec, next) {
        return guardAsync(exec)
          .then(function (d) {
            if (d !== null) return d;
            return next();
          })
          .catch(function (e) {
            return { kind: 'deny', reason: 'Subagent pool guard error: ' + (e && e.message ? e.message : String(e)) };
          });
      });
      // systemPrompt guidance: registered once; text function gated on `enabled`
      if (systemPrompt) {
        systemPrompt.section({
          name: 'subagent-pool',
          order: 1000,
          text: function () {
            if (!enabled || !config) return '';
            const lines = [];
            lines.push('Subagent pool active: max ' + config.totalCap + ' concurrent. Routes (pick the one that fits the task):');
            for (let i = 0; i < config.routes.length; i++) {
              const r = config.routes[i];
              const p = r.profile || {};
              const cap = (typeof r.maxThinking === 'string' && r.maxThinking !== '') ? 'max thinking ' + r.maxThinking : 'no thinking cap';
              const desc = [];
              if (p.bestFor) desc.push('good for: ' + p.bestFor);
              if (p.avoidFor) desc.push('avoid: ' + p.avoidFor);
              if (p.thinking) desc.push('thinking=' + p.thinking);
              if (p.speed) desc.push('speed=' + p.speed);
              if (p.instructions) desc.push('instructions: ' + p.instructions);
              if (p.notes) desc.push(p.notes);
              lines.push('- ' + r.provider + '/' + r.model + ' (cap ' + r.cap + ', ' + cap + ')' + (desc.length ? ': ' + desc.join('; ') : ''));
            }
            if (queue.length > 0) {
              const parts = {};
              for (let i = 0; i < queue.length; i++) {
                const k = queue[i].totalOnly ? 'total-cap' : queue[i].key;
                parts[k] = (parts[k] || 0) + 1;
              }
              const desc = [];
              for (const k in parts) desc.push(parts[k] + ' on ' + k);
              lines.push('Queue: ' + queue.length + ' request(s) waiting (' + desc.join(', ') + '). At-capacity requests wait for a free slot (up to ' + Math.round(queueMaxWaitMs() / 1000) + 's each) and are admitted automatically as slots free.');
            }
            lines.push('Routing: prefer ' + listRoutes() + ' (profile above). Pick by task depth, not by availability. Unconfigured routes and over-cap thinking levels are denied; at-capacity routes wait in the queue automatically.');
            return lines.join('\n');
          }
        });
      }
      // restore the selection namespace on dispose
      if (settings) {
        ctx.effect(function () {
          return function () { restoreNamespace().catch(function () {}); };
        }, 'subagent-pool-ns-restore');
      }
      if (timer && typeof timer.interval === 'function') {
        ctx.effect(function () {
          return timer.interval(function () { processQueue(); }, 5000);
        }, 'subagent-pool-queue-sweep');
      }
      ctx.effect(function () {
        return function () { flushQueue('stopped while request was waiting in the queue.'); };
      }, 'subagent-pool-queue-flush');
    }

