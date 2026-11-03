    // Settle a queue entry exactly once: clear its timer/abort listener,
    // remove it from the queue, resolve the guard's promise.
    function settleEntry(e, value) {
      if (e.settled) return;
      e.settled = true;
      if (e.stopTimer) { try { e.stopTimer(); } catch (err2) {} e.stopTimer = null; }
      if (e.signal && e.onAbort && typeof e.signal.removeEventListener === 'function') {
        try { e.signal.removeEventListener('abort', e.onAbort); } catch (err2) {}
      }
      const i = queue.indexOf(e);
      if (i !== -1) queue.splice(i, 1);
      e.resolve(value);
    }

    function flushQueue(msg) {
      const q = queue.slice();
      queue.length = 0;
      for (let i = 0; i < q.length; i++) settleEntry(q[i], { kind: 'deny', reason: 'Subagent pool: ' + msg });
    }

    // Admit as many queued entries as capacity allows. Called on every
    // agent lifecycle event, on configure/boot, and by a 5s sweep. A
    // single pass keeps local admitted counters so two entries for the
    // same route in one pass cannot claim the same slot.
    function processQueue() {
      if (!enabled || !config || queue.length === 0) return;
      const c = counts();
      let totalRunning = c.totalRunning;
      const admitted = {};
      let admittedTotal = 0;
      for (let i = 0; i < queue.length; i++) {
        const e = queue[i];
        const rcfg = findRoute(e.route);
        if (!rcfg) {
          log('pool: queue reject ' + e.key + ' (route removed)');
          settleEntry(e, { kind: 'deny', reason: 'Subagent pool: route ' + e.key + ' is no longer configured; use ' + listRoutes() + '.' });
          i--;
          continue;
        }
        if (e.totalOnly) {
          // workflow/ralph: wait until total capacity frees up. Admission
          // does not consume a route slot — each of its child subagent
          // calls goes through the route check individually.
          if (totalRunning + admittedTotal < config.totalCap) {
            log('pool: queue admit total (waited ' + Math.round((Date.now() - e.since) / 1000) + 's)');
            settleEntry(e, null);
            i--;
          }
          continue;
        }
        const rk = (c.byRoute[e.key] ? c.byRoute[e.key].running : 0) + (admitted[e.key] || 0);
        if (rk >= rcfg.cap || totalRunning + admittedTotal >= config.totalCap) continue;
        admitted[e.key] = (admitted[e.key] || 0) + 1;
        admittedTotal++;
        log('pool: queue admit ' + e.key + ' (waited ' + Math.round((Date.now() - e.since) / 1000) + 's)');
        settleEntry(e, null);
        i--;
      }
    }

    // Hold the tool call until a slot frees, the signal aborts, or the
    // wait timeout elapses. Resolves null (admit) or {kind:'deny',reason}.
    function waitInQueue(route, key, signal, totalOnly) {
      if (!timer || typeof timer.timeout !== 'function') {
        return Promise.resolve({ kind: 'deny', reason: 'Subagent pool: at capacity and queueing unavailable (timer service missing); wait and retry.' });
      }
      if (queue.length >= queueMaxLen()) {
        return Promise.resolve({ kind: 'deny', reason: 'Subagent pool: queue is full (' + queue.length + ' waiting); try another route or retry in a moment.' });
      }
      return new Promise(function (resolve) {
        const e = {
          id: nextQid++,
          route: route,
          key: key,
          since: Date.now(),
          totalOnly: !!totalOnly,
          resolve: resolve,
          settled: false,
          stopTimer: null,
          onAbort: null,
          signal: null
        };
        if (signal && typeof signal === 'object') {
          if (signal.aborted === true) {
            queue.push(e);
            settleEntry(e, { kind: 'deny', reason: 'Subagent pool: request was already aborted.' });
            return;
          }
          if (typeof signal.addEventListener === 'function') {
            e.signal = signal;
            e.onAbort = function () {
              log('pool: queue abort ' + e.key);
              settleEntry(e, { kind: 'deny', reason: 'Subagent pool: request was aborted while waiting in the queue.' });
            };
            try { signal.addEventListener('abort', e.onAbort); } catch (err2) { e.signal = null; e.onAbort = null; }
          }
        }
        const maxWait = queueMaxWaitMs();
        e.stopTimer = timer.timeout(function () {
          log('pool: queue timeout ' + e.key + ' after ' + Math.round(maxWait / 1000) + 's');
          settleEntry(e, { kind: 'deny', reason: 'Subagent pool: waited ' + Math.round(maxWait / 1000) + 's in queue and no slot freed; retry later or use another route.' });
        }, maxWait);
        queue.push(e);
        log('pool: queue wait ' + key + ' (queue now ' + queue.length + ')');
        processQueue(); // in case capacity just freed up
      });
    }

