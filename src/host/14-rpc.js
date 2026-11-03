    // ---- RPC: always registered (active + degraded) ----
    function registerRpc() {
      if (!harness) return;
      harness.handle('pool.status', function () { return statusPayload(); });
      // Model catalog for UI dropdowns: every registered provider plus its
      // advisory model list. Catalog membership is advisory (adapters may
      // accept unlisted ids), so the UI keeps unlisted values selectable.
      harness.handle('pool.models', function () {
        if (!llm) return Promise.resolve({ ok: false, error: 'llm service unavailable' });
        let providers;
        try { providers = llm.listProviders(); } catch (e) {
          return Promise.resolve({ ok: false, error: 'listProviders failed: ' + (e && e.message ? e.message : String(e)) });
        }
        const out = [];
        const pending = [];
        for (let i = 0; i < providers.length; i++) {
          const p = providers[i];
          const entry = { id: p.id, name: p.name || p.id, models: [] };
          out.push(entry);
          pending.push(
            llm.listModels(p.id).then(function (ms) {
              entry.models = ms.map(function (m) {
                return { id: m.id, name: m.name || m.id, description: m.description || '' };
              });
            }).catch(function (e) {
              entry.error = e && e.message ? e.message : String(e);
            })
          );
        }
        return Promise.all(pending).then(function () { return { ok: true, providers: out }; });
      });
      // Exact-model metadata (reasoning efforts) for one route.
      harness.handle('pool.modelInfo', function (args) {
        if (!llm) return Promise.resolve({ ok: false, error: 'llm service unavailable' });
        const p = args && args.provider;
        const m = args && args.model;
        if (typeof p !== 'string' || p === '' || typeof m !== 'string' || m === '') {
          return Promise.resolve({ ok: false, error: 'provider and model are required' });
        }
        return llm.resolveModelInfo(p, m).then(function (info) {
          const out = {
            ok: true,
            model: info.id,
            name: info.name || info.id,
            contextWindow: (info.context && typeof info.context.contextWindow === 'number') ? info.context.contextWindow : null,
            defaultMaxTokens: (typeof info.defaultMaxTokens === 'number') ? info.defaultMaxTokens : null,
            reasoning: null
          };
          if (info.reasoning && typeof info.reasoning === 'object') {
            out.reasoning = {
              efforts: (info.reasoning.efforts || []).map(function (e) {
                return { id: e.id, name: e.name || e.id, description: e.description || '' };
              }),
              defaultEffort: info.reasoning.defaultEffort || null
            };
          }
          return out;
        }).catch(function (e) {
          return { ok: false, error: e && e.message ? e.message : String(e) };
        });
      });
      harness.handle('pool.configure', function (req) {
        const r = (req && typeof req === 'object') ? req : {};
        const base = config || { version: 1, enabled: false, totalCap: 1, routes: [] };
        const next = {
          version: 3,
          enabled: r.enabled !== undefined ? (r.enabled === true) : (base ? base.enabled === true : true),
          totalCap: r.totalCap !== undefined ? r.totalCap : base.totalCap,
          queueMaxWaitSec: r.queueMaxWaitSec !== undefined ? r.queueMaxWaitSec : (typeof base.queueMaxWaitSec === 'number' ? base.queueMaxWaitSec : 300),
          queueMaxLen: r.queueMaxLen !== undefined ? r.queueMaxLen : (Number.isInteger(base.queueMaxLen) ? base.queueMaxLen : 20),
          routes: r.routes !== undefined ? r.routes : base.routes
        };
        const verr = validateConfig(next);
        if (verr) return { ok: false, error: 'invalid config: ' + verr };
        return writeConfig(next).then(function () {
          config = next;
          enabled = (next.enabled === true);
          reason = enabled ? '' : 'disabled by configure';
          if (enabled) { applyNamespace(); processQueue(); }
          else { restoreNamespace(); flushQueue('disabled while request was waiting in the queue.'); }
          return { ok: true, status: statusPayload() };
        }).catch(function (e) {
          return { ok: false, error: 'write failed: ' + (e && e.message ? e.message : String(e)) };
        });
      });
    }

