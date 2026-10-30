// Subagent Pool — client half v5 (pkg-5).
// vs v4: UI polish only — visible button/badge text (bg-base on
// brand/state), de-cramped configure card (fixed label column, flexible
// select widths, full-width free-text profile inputs), 2-column profile
// summary under route rows, shorter guidance line, static effort-ladder
// fallback in the max-thinking select when modelInfo fails. Behavior
// (3s polling, RPC methods, queue display) unchanged.
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

    function num(v) {
      const n = parseInt(v, 10);
      return Number.isFinite(n) && n >= 1 ? n : 1;
    }

    function emptyProfile() {
      return { thinking: '', speed: '', instructions: '', bestFor: '', avoidFor: '', notes: '' };
    }

    function normRoute(r) {
      const p = (r && r.profile && typeof r.profile === 'object') ? r.profile : {};
      return {
        provider: (r && typeof r.provider === 'string') ? r.provider : '',
        model: (r && typeof r.model === 'string') ? r.model : '',
        cap: (r && typeof r.cap === 'number' && r.cap >= 1) ? r.cap : 1,
        tier: (r && r.tier) ? r.tier : '',
        maxThinking: (r && typeof r.maxThinking === 'string') ? r.maxThinking : '',
        profile: {
          thinking: p.thinking || '',
          speed: p.speed || '',
          instructions: p.instructions || '',
          bestFor: p.bestFor || '',
          avoidFor: p.avoidFor || '',
          notes: p.notes || ''
        }
      };
    }

    function providerOptions(catalog, current) {
      if (!catalog || !Array.isArray(catalog.providers)) return current ? [current] : [];
      const ids = catalog.providers.map(function (p) { return p.id; });
      if (current && ids.indexOf(current) === -1) ids.unshift(current);
      return ids;
    }

    function modelOptions(catalog, provider, current) {
      let ids = [];
      if (catalog && Array.isArray(catalog.providers)) {
        for (let i = 0; i < catalog.providers.length; i++) {
          if (catalog.providers[i].id === provider) {
            ids = catalog.providers[i].models.map(function (m) { return m.id; });
            break;
          }
        }
      }
      if (current && ids.indexOf(current) === -1) ids.unshift(current);
      return ids;
    }

    function PoolPage(props) {
      const close = props && typeof props.close === 'function' ? props.close : null;
      const [status, setStatus] = React.useState(null);
      const [error, setError] = React.useState(null);
      const [form, setForm] = React.useState({ enabled: false, totalCap: 2, routes: [] });
      const [busy, setBusy] = React.useState(false);
      const [lastError, setLastError] = React.useState(null);
      const [catalog, setCatalog] = React.useState(null);       // {providers:[...]}
      const [catalogError, setCatalogError] = React.useState(null);
      const [infoMap, setInfoMap] = React.useState({});          // "p/m" -> modelInfo result

      function patchForm(p) {
        setForm(function (f) {
          return {
            enabled: p.enabled !== undefined ? p.enabled : f.enabled,
            totalCap: p.totalCap !== undefined ? p.totalCap : f.totalCap,
            routes: p.routes !== undefined ? p.routes : f.routes,
          };
        });
      }

      function updateRoute(i, patch) {
        setForm(function (f) {
          const routes = f.routes.slice();
          routes[i] = Object.assign({}, routes[i], patch);
          return { enabled: f.enabled, totalCap: f.totalCap, routes: routes };
        });
      }

      function updateProfile(i, field, value) {
        setForm(function (f) {
          const routes = f.routes.slice();
          routes[i] = Object.assign({}, routes[i], { profile: Object.assign({}, routes[i].profile, { [field]: value }) });
          return { enabled: f.enabled, totalCap: f.totalCap, routes: routes };
        });
      }

      // Poll: plain-JSON status only touches state; failures keep last good status.
      function refresh() {
        return host.call('pool.status', undefined)
          .then(function (s) {
            setError(null);
            setStatus(s);
            setForm(function (f) {
              if (f.routes.length > 0) return f; // never clobber in-progress user edits
              if (s && Array.isArray(s.routes) && s.routes.length > 0) {
                return {
                  enabled: s.enabled === true,
                  totalCap: typeof s.totalCap === 'number' ? s.totalCap : 2,
                  routes: s.routes.map(normRoute),
                };
              }
              return { enabled: false, totalCap: 2, routes: DEFAULT_ROUTES.map(normRoute) };
            });
          })
          .catch(function (e) {
            setError(e && e.message ? e.message : String(e));
          });
      }

      function loadCatalog() {
        return host.call('pool.models', undefined)
          .then(function (res) {
            if (res && res.ok === true) { setCatalog(res); setCatalogError(null); }
            else setCatalogError(res && res.error ? res.error : 'model catalog unavailable');
          })
          .catch(function (e) {
            setCatalogError(e && e.message ? e.message : String(e));
          });
      }

      // Lazy-fetch exact model info (reasoning efforts) per configured route.
      const infoKeys = form.routes
        .map(function (r) { return (r.provider && r.model) ? r.provider + '/' + r.model : ''; })
        .filter(Boolean)
        .join('|');
      React.useEffect(function () {
        if (!infoKeys) return;
        const keys = infoKeys.split('|');
        for (let i = 0; i < keys.length; i++) {
          const k = keys[i];
          if (infoMap[k] !== undefined || inflight[k]) continue;
          const slash = k.indexOf('/');
          const provider = k.slice(0, slash);
          const model = k.slice(slash + 1);
          inflight[k] = true;
          host.call('pool.modelInfo', { provider: provider, model: model })
            .then(function (res) {
              setInfoMap(function (m) { const n = Object.assign({}, m); n[k] = res; return n; });
            })
            .catch(function (e) {
              setInfoMap(function (m) {
                const n = Object.assign({}, m);
                n[k] = { ok: false, error: e && e.message ? e.message : String(e) };
                return n;
              });
            })
            .then(function () { delete inflight[k]; });
        }
      }, [infoKeys]);

      function configure(patch) {
        setBusy(true);
        setLastError(null);
        host.call('pool.configure', patch)
          .then(function (res) {
            if (!res || res.ok !== true) {
              setLastError(res && res.error ? res.error : 'configure failed');
              return;
            }
            if (res.status) setStatus(res.status);
          })
          .catch(function (e) {
            setLastError(e && e.message ? e.message : String(e));
          })
          .then(function () {
            setBusy(false);
          });
      }

      React.useEffect(function () {
        refresh();
        loadCatalog();
        return ctx.interval(function () { refresh(); }, 3000);
      }, []);

      const s = status;
      const enabled = !!(s && s.enabled);
      const liveRoutes = s && Array.isArray(s.routes) ? s.routes : [];
      const useSelects = catalogError === null;
      const rows = [];

      // (a) header: title + badge + optional close
      rows.push(React.createElement('div', { key: 'hdr', style: { display: 'flex', alignItems: 'center', gap: 8 } },
        React.createElement('span', { style: { fontSize: 16, fontWeight: 600, color: T.text } }, 'Subagent Pool'),
        React.createElement('span', { style: { background: enabled ? T.ok : T.err, color: 'var(--dsw-alias-bg-base)', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10 } }, enabled ? 'ACTIVE' : 'INACTIVE'),
        close ? React.createElement('button', { key: 'close', style: { marginLeft: 'auto', background: 'none', border: 'none', color: T.muted, fontSize: 12, cursor: 'pointer' }, onClick: close }, 'Close') : null
      ));

      // (f) polling / catalog error banner
      if (error) {
        rows.push(React.createElement('div', { key: 'poll-err', style: { fontSize: 12, color: T.err } }, 'Status polling failed: ' + error));
      }
      if (catalogError) {
        rows.push(React.createElement('div', { key: 'cat-err', style: { fontSize: 12, color: T.muted } }, 'Model catalog unavailable (' + catalogError + ') — falling back to text inputs.'));
      }

      if (s === null) {
        rows.push(React.createElement('div', { key: 'loading', style: { fontSize: 13, color: T.muted } }, 'Loading pool status…'));
      } else if (enabled) {
        // (b) running total + one row per route, with capability summary
        rows.push(React.createElement('div', { key: 'running', style: { fontSize: 13, color: T.text } },
          'Running: ' + (s.totalRunning != null ? s.totalRunning : 0) + ' / ' + (s.totalCap != null ? s.totalCap : '?')));
        // (b2) queue depth + per-entry wait times (v4)
        const q = s.queue || null;
        rows.push(
          React.createElement('div', {
            key: 'queue',
            style: { display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap', marginTop: 2 }
          },
          React.createElement('span', { style: smallMuted }, q && q.total > 0 ? 'Queue: ' + q.total + ' waiting' : 'Queue: empty'),
          q ? React.createElement('span', { style: Object.assign({}, smallMuted, { opacity: 0.7 }) },
            '(limits: up to ' + q.maxLen + ' waiting, ' + q.maxWaitSec + 's wait each)') : null
          )
        );
        if (q && q.waiting) {
          for (let j = 0; j < q.waiting.length; j++) {
            const w = q.waiting[j];
            rows.push(
              React.createElement('div', {
                key: 'q' + j,
                style: Object.assign({}, smallMuted, { paddingLeft: 12 })
              }, '#' + w.id + ' ' + w.route + ' — waiting ' + w.waitingSec + 's')
            );
          }
        }
        for (let i = 0; i < liveRoutes.length; i++) {
          const r = liveRoutes[i];
          rows.push(React.createElement('div', { key: 'route-' + i, style: { display: 'flex', alignItems: 'center', gap: 8, background: T.card, border: '1px solid ' + T.border, borderRadius: 8, padding: 8 } },
            React.createElement('span', { style: { fontSize: 13, color: T.text } }, r.provider + '/' + r.model),
            r.tier ? React.createElement('span', { key: 'tier', style: { fontSize: 11, color: T.muted } }, '[' + r.tier + ']') : null,
            React.createElement('span', { key: 'cnt', style: { marginLeft: 'auto', fontSize: 12, color: T.muted } }, 'running ' + (r.running != null ? r.running : 0) + '/' + (r.cap != null ? r.cap : 0) + ' \u00b7 idle ' + (r.idle != null ? r.idle : 0))
          ));
          const p = r.profile;
          const bits = [];
          if (r.maxThinking) bits.push('max thinking: ' + r.maxThinking);
          if (p && p.thinking) bits.push('thinking: ' + p.thinking);
          if (p && p.speed) bits.push('speed: ' + p.speed);
          if (p && p.instructions) bits.push('instructions: ' + p.instructions);
          if (p && p.bestFor) bits.push('good for: ' + p.bestFor);
          if (p && p.avoidFor) bits.push('avoid: ' + p.avoidFor);
          if (bits.length > 0) {
            rows.push(React.createElement('div', { key: 'route-' + i + '-profile', style: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', columnGap: 16, rowGap: 2, paddingLeft: 8, paddingTop: 2, fontSize: 11, color: T.muted } },
              bits.map(function (b, k) {
                return React.createElement('span', { key: k, style: { minWidth: 0 } }, b);
              })
            ));
          }

        }
      } else {
        // (c) inactive: reason + Enable (full routes required when no config was loaded)
        rows.push(React.createElement('div', { key: 'reason', style: { fontSize: 13, color: T.muted } }, s.inactiveReason || 'inactive'));
        rows.push(React.createElement('button', {
          key: 'enable',
          style: btnStyle,
          disabled: busy,
          onClick: function () { configure({ enabled: true, totalCap: form.totalCap, routes: form.routes }); },
        }, 'Enable'));
      }

      // (d) routing guidance
      rows.push(React.createElement('div', { key: 'guidance', style: { fontSize: 12, color: T.muted } },
        'Routing: prefer ' + (s && Array.isArray(s.routes) && s.routes.length > 0 ? s.routes.map(function (r) { return r.provider + '/' + r.model; }).join(', ') : 'the configured routes') + '. Pick by task depth, not availability — at-capacity routes queue automatically; only unconfigured routes and over-cap thinking are denied.'));

      // (e) configure card
      const card = [];
      card.push(React.createElement('div', { key: 'top', style: { display: 'flex', alignItems: 'center', gap: 24 } },
        React.createElement('label', { style: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: T.text } },
          React.createElement('input', {
            type: 'checkbox',
            checked: form.enabled === true,
            onChange: function (e) { patchForm({ enabled: e.target.checked !== false }); },
          }),
          'Enabled'),
        React.createElement('label', { style: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: T.text } },
          'Total cap',
          React.createElement('input', {
            type: 'number',
            min: 1,
            value: form.totalCap,
            style: Object.assign({}, inputStyle, { width: 64 }),
            onChange: function (e) { patchForm({ totalCap: num(e.target.value) }); },
          }))
      ));

      for (let i = 0; i < form.routes.length; i++) {
        const r = form.routes[i];
        const key = r.provider + '/' + r.model;
        const info = infoMap[key];
        const efforts = (info && info.ok === true && info.reasoning) ? info.reasoning.efforts : [];
        // line 1: provider / model / cap
        let pvEl, mdEl;
        if (useSelects) {
          pvEl = React.createElement('select', { key: 'pv', value: r.provider, style: Object.assign({}, selectStyle, { flex: 1, minWidth: 110 }),
            onChange: function (e) { updateRoute(i, { provider: e.target.value, model: '', maxThinking: '' }); } },
            providerOptions(catalog, r.provider).map(function (id) {
              return React.createElement('option', { key: id, value: id }, id);
            })
          );
          const modelOpts = modelOptions(catalog, r.provider, r.model);
          mdEl = React.createElement('select', { key: 'md', value: r.model, style: Object.assign({}, selectStyle, { flex: 1.4, minWidth: 130 }),
            onChange: function (e) { updateRoute(i, { model: e.target.value, maxThinking: '' }); } },
            React.createElement('option', { key: '__empty', value: '' }, '— model —'),
            modelOpts.map(function (id) {
              return React.createElement('option', { key: id, value: id }, id);
            })
          );
        } else {
          pvEl = React.createElement('input', { key: 'pv', type: 'text', value: r.provider, placeholder: 'provider', style: Object.assign({}, inputStyle, { flex: 1, minWidth: 110 }),
            onChange: function (e) { updateRoute(i, { provider: e.target.value, maxThinking: '' }); } });
          mdEl = React.createElement('input', { key: 'md', type: 'text', value: r.model, placeholder: 'model', style: Object.assign({}, inputStyle, { flex: 1.4, minWidth: 130 }),
            onChange: function (e) { updateRoute(i, { model: e.target.value, maxThinking: '' }); } });
        }
        const cpEl = React.createElement('input', { key: 'cp', type: 'number', min: 1, value: r.cap, style: Object.assign({}, inputStyle, { width: 56, flexShrink: 0 }),
          onChange: function (e) { updateRoute(i, { cap: num(e.target.value) }); } });

        // line 2: max thinking (advertised efforts for the selected model)
        const mtOpts = (efforts.length > 0) ? efforts.map(function (e) { return e.id; }) : EFFORT_LADDER.slice();
        if (r.maxThinking && mtOpts.indexOf(r.maxThinking) === -1) mtOpts.push(r.maxThinking);
        const mtEl = React.createElement('select', { key: 'mt', value: r.maxThinking, style: Object.assign({}, selectStyle, { width: 150 }),
          onChange: function (e) { updateRoute(i, { maxThinking: e.target.value }); } },
          React.createElement('option', { key: '__none', value: '' }, 'no thinking cap'),
          mtOpts.map(function (id) {
            let eff = null;
            for (let j = 0; j < efforts.length; j++) { if (efforts[j].id === id) { eff = efforts[j]; break; } }
            const label = eff ? (id + (eff.name && eff.name !== id ? ' — ' + eff.name : '')) : id;
            return React.createElement('option', { key: id, value: id }, label);
          })
        );
        const mtHint = [];
        if (r.provider && r.model) {
          if (info === undefined) mtHint.push('loading efforts…');
          else if (info && info.ok !== true) mtHint.push('no advertised efforts; free choice above');
          else if (info.reasoning === null) mtHint.push('model advertises no reasoning efforts');
          else if (info.reasoning.defaultEffort) mtHint.push('model default: ' + info.reasoning.defaultEffort);
        }
        const mthEl = mtHint.length > 0 ? React.createElement('span', { key: 'mth', style: smallMuted }, mtHint.join(' ')) : null;

        // line 3: capability profile
        const ptEl = React.createElement('select', { key: 'pt', value: r.profile.thinking, style: Object.assign({}, selectStyle, { flex: 1, minWidth: 90 }),
          onChange: function (e) { updateProfile(i, 'thinking', e.target.value); } },
          React.createElement('option', { key: '', value: '' }, 'thinking: —'),
          THINKING_OPTS.map(function (o) { return React.createElement('option', { key: o, value: o }, o); })
        );
        const psEl = React.createElement('select', { key: 'ps', value: r.profile.speed, style: Object.assign({}, selectStyle, { flex: 1, minWidth: 90 }),
          onChange: function (e) { updateProfile(i, 'speed', e.target.value); } },
          React.createElement('option', { key: '', value: '' }, 'speed: —'),
          SPEED_OPTS.map(function (o) { return React.createElement('option', { key: o, value: o }, o); })
        );
        const piEl = React.createElement('select', { key: 'pi', value: r.profile.instructions, style: Object.assign({}, selectStyle, { flex: 1.3, minWidth: 110 }),
          onChange: function (e) { updateProfile(i, 'instructions', e.target.value); } },
          React.createElement('option', { key: '', value: '' }, 'instructions: —'),
          INSTRUCTIONS_OPTS.map(function (o) { return React.createElement('option', { key: o, value: o }, o); })
        );
        const pbEl = React.createElement('input', { key: 'pb', type: 'text', value: r.profile.bestFor, placeholder: 'good for…', style: Object.assign({}, inputStyle, { width: '100%' }),
          onChange: function (e) { updateProfile(i, 'bestFor', e.target.value); } });
        const paEl = React.createElement('input', { key: 'pa', type: 'text', value: r.profile.avoidFor, placeholder: 'avoid…', style: Object.assign({}, inputStyle, { width: '100%' }),
          onChange: function (e) { updateProfile(i, 'avoidFor', e.target.value); } });
        const pnEl = React.createElement('input', { key: 'pn', type: 'text', value: r.profile.notes, placeholder: 'notes (optional)', style: Object.assign({}, inputStyle, { width: '100%' }),
          onChange: function (e) { updateProfile(i, 'notes', e.target.value); } });

        card.push(React.createElement('div', { key: 'fr-' + i, style: { display: 'flex', flexDirection: 'column', gap: 6, border: '1px dashed ' + T.border, borderRadius: 8, padding: 10, background: T.field } },
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' } },
            React.createElement('span', { style: Object.assign({}, smallMuted, { width: 84, flexShrink: 0 }) }, 'route'),
            pvEl, mdEl, cpEl
          ),
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' } },
            React.createElement('span', { style: Object.assign({}, smallMuted, { width: 84, flexShrink: 0 }) }, 'max thinking'),
            mtEl, mthEl
          ),
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' } },
            React.createElement('span', { style: Object.assign({}, smallMuted, { width: 84, flexShrink: 0 }) }, 'profile'),
            ptEl, psEl, piEl
          ),
          React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 4 } },
            pbEl, paEl, pnEl
          )
        ));
      }

      card.push(React.createElement('button', {
        key: 'save',
        style: Object.assign({}, btnStyle, { alignSelf: 'flex-start' }),
        disabled: busy,
        onClick: function () { configure({ enabled: form.enabled, totalCap: form.totalCap, routes: form.routes }); },
      }, 'Save'));
      if (lastError) {
        card.push(React.createElement('div', { key: 'last-err', style: { fontSize: 12, color: T.err } }, lastError));
      }
      rows.push(React.createElement('div', { key: 'cfg', style: { display: 'flex', flexDirection: 'column', gap: 8, background: T.card, border: '1px solid ' + T.border, borderRadius: 8, padding: 12, marginTop: 16 } }, card));

      return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 720, padding: 16, fontSize: 13, color: T.text, fontFamily: 'inherit' } }, rows);
    }

    const slots = ctx.get('slots');
    if (slots === undefined) return;
    slots.inject('settings.section', function () {
      return slots.register(
        { name: 'settings.section', id: 'subagent-pool', order: 25, label: 'Subagent Pool' },
        function (props) { return React.createElement(PoolPage, props || null); }
      );
    });
  },
};
