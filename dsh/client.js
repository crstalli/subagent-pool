window.__ModuleLoader__.load(
  {
    id: "dsh-subagent-pool",
    factory: (require) => {
      var module = { exports: {} };
      var exports = module.exports;

      var React = require("react");

      var NAME = "subagent-pool";
      var KEY = "subagent-pool";
      var ROUTE = "/subagent-pool";

      // Theme tokens: use the Web GUI's own --dsw-* variables so the card
      // follows light/dark mode and matches the other settings pages exactly.
      var T = {
        bg: 'var(--dsw-alias-bg-base)',
        card: 'var(--dsw-alias-settings-card-fill)',
        border: 'var(--dsw-alias-border-l2)',
        borderStrong: 'var(--dsw-alias-border-l4)',
        text: 'var(--dsw-alias-label-primary)',
        muted: 'var(--dsw-alias-label-secondary)',
        err: 'var(--dsw-alias-state-error-primary)',
        ok: 'var(--dsw-alias-state-success-primary)',
        warn: 'var(--dsw-alias-state-warning-primary, var(--dsw-alias-state-business-primary))',
        primary: 'var(--dsw-alias-button-primary-fill)',
        primaryFg: 'var(--dsw-alias-label-primary-foreground)',
        field: 'var(--dsw-alias-bg-layer-1)',
        input: 'var(--dsw-alias-bg-layer-3)',
        hover: 'var(--dsw-alias-interactive-bg-hover)',
        brand: 'var(--dsw-alias-brand-primary)',
        accent: 'var(--dsw-alias-state-business-primary)',
        switchOff: 'var(--dsw-alias-border-l3)',
        thumbOff: 'var(--dsw-alias-switch-thumb)',
        thumbOn: 'var(--dsw-alias-label-primary-foreground)'
      };

      // One-shot <style> injection: classes mirror the app's own components
      // (._input_181ew_115 field spec, ._switch_1ik0f_5 switch spec, icon
      // buttons, settings cards) so hover/focus/disabled states behave like
      // the rest of the GUI.
      var CSS_ID = 'dsh-subagent-pool-style';
      function ensureCss() {
        if (typeof document === 'undefined' || document.getElementById(CSS_ID)) return;
        var st = document.createElement('style');
        st.id = CSS_ID;
        st.textContent = [
          '.dsp-input,.dsp-select{box-sizing:border-box;width:100%;height:34px;padding:0 12px;',
          'border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md);',
          'background:var(--dsw-alias-bg-layer-3);font:inherit;font-size:13px;line-height:1.5;',
          'color:var(--dsw-alias-label-primary)}',
          '.dsp-input:focus-visible,.dsp-select:focus-visible{outline:none;border-color:var(--dsw-alias-state-business-primary)}',
          '.dsp-input:disabled,.dsp-select:disabled{opacity:.5;cursor:default}',
          '.dsp-input::placeholder{color:var(--dsw-alias-label-secondary);opacity:.6}',
          '.dsp-selwrap{position:relative;display:block;width:100%}',
          '.dsp-select{appearance:none;-webkit-appearance:none;cursor:pointer;padding-right:28px;',
          'text-overflow:ellipsis;white-space:nowrap;overflow:hidden}',
          '.dsp-selchev{position:absolute;right:10px;top:50%;transform:translateY(-50%);pointer-events:none;font-size:9px;color:var(--dsw-alias-label-secondary)}',
          '.dsp-btn{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:4px;',
          'height:34px;padding:0 14px;border-radius:var(--dsw-radius-md);font:inherit;font-size:14px;line-height:22px;cursor:pointer;border:.5px solid transparent}',
          '.dsp-btn:disabled{opacity:.5;cursor:default}',
          '.dsp-btn-primary{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);border:none}',
          '.dsp-btn-primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover)}',
          '.dsp-btn-ghost{background:var(--dsw-alias-button-elevated-fill);color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l3)}',
          '.dsp-btn-ghost:hover:not(:disabled){background:var(--dsw-alias-button-ghost-active-hover)}',
          '.dsp-iconbtn{width:28px;height:28px;flex:0 0 auto;border:none;border-radius:8px;background:transparent;',
          'color:var(--dsw-alias-label-secondary);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;font-size:16px;line-height:1;padding:0}',
          '.dsp-iconbtn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
          '.dsp-iconbtn:disabled{opacity:.5;cursor:default}',
          '.dsp-card{border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-settings-card-fill);padding:12px}',
          '.dsp-chip{display:inline-block;background:var(--dsw-alias-interactive-bg-hover);border-radius:6px;padding:1px 6px;font-size:11px;color:var(--dsw-alias-label-secondary);white-space:nowrap}',
          '.dsp-label{font-size:11px;color:var(--dsw-alias-label-secondary)}',
          '.dsp-h{font-size:11px;text-transform:uppercase;letter-spacing:.5px;font-weight:bold;color:var(--dsw-alias-label-secondary)}'
        ].join('');
        (document.head || document.documentElement).appendChild(st);
      }

      var DEFAULT_ROUTES = [
        { provider: 'qwen_local', model: 'qwen38_27b_medium', cap: 1, tier: 'deep' },
        { provider: 'ollama_local', model: 'gemma4_12b', cap: 1, tier: 'easy' }
      ];

      var THINKING_OPTS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'];
      var SPEED_OPTS = ['fast', 'medium', 'slow'];
      var INSTRUCTIONS_OPTS = ['high-level ok', 'explicit', 'step-by-step'];
      var EFFORT_LADDER = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'];

      function num(v) {
        var n = parseInt(v, 10);
        return Number.isFinite(n) ? n : 1;
      }

      function capNum(v) {
        var n = parseInt(v, 10);
        return (Number.isFinite(n) && n >= 0) ? n : 1;
      }

      function emptyProfile() {
        return { thinking: '', speed: '', instructions: '', bestFor: '', avoidFor: '', notes: '' };
      }

      function normRoute(r) {
        var p = (r && r.profile && typeof r.profile === 'object') ? r.profile : {};
        return {
          provider: (r && typeof r.provider === 'string') ? r.provider : '',
          model: (r && typeof r.model === 'string') ? r.model : '',
          cap: (r && typeof r.cap === 'number' && r.cap >= 0) ? r.cap : 1,
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

      function fetchJson(path) {
        return fetch(path, { method: 'GET', headers: { 'Accept': 'application/json' } })
          .then(function (r) { return r.json(); })
          .catch(function (e) { return Promise.reject(e); });
      }

      function configureApi(data) {
        var b64 = btoa(JSON.stringify(data));
        return fetch('/subagent-pool/configure?config=' + encodeURIComponent(b64), { method: 'GET', headers: { 'Accept': 'application/json' } })
          .then(function (r) { return r.json(); })
          .catch(function (e) { return Promise.reject(e); });
      }

      function CardFactory(react) {
        return function PoolPage(props) {
          // Slot ownerProps: { view, form? } — on the row page
          // (plugins.row.config, key "<pkg>#<rowId>") the plugin manager passes
          // form = { state: ConfigFormSnapshot, mutate(ops, revision) } for this
          // plugin's own configurable entry ('subagent-pool'). When present we
          // read initial values from form.state.value and save via form.mutate
          // (the standard volatile-settings write path); otherwise we fall back
          // to the /subagent-pool/configure HTTP endpoint.
          var formRef = React.useRef(null);
          formRef.current = (props && props.form) || null;
          var [statusVal, setStatusVal] = React.useState(null);
          var [errVal, setErrVal] = React.useState(null);
          var [formVal, setFormVal] = React.useState({ enabled: false, totalCap: 2, totalCapAuto: false, routes: [] });
          var [busyVal, setBusyVal] = React.useState(false);
          var [lastErrorVal, setLastErrorVal] = React.useState(null);
          var [catalogVal, setCatalogVal] = React.useState(null);
          var [catalogErrVal, setCatalogErrVal] = React.useState(null);
          var [infoMapVal, setInfoMapVal] = React.useState({});
          var [openVal, setOpenVal] = React.useState({});
          var lastCapRef = React.useRef({});
          var inflight = {};

          function patchForm(p) {
            setFormVal(function (f) {
              return {
                enabled: p.enabled !== undefined ? p.enabled : f.enabled,
                totalCap: p.totalCap !== undefined ? p.totalCap : f.totalCap,
                totalCapAuto: p.totalCapAuto !== undefined ? p.totalCapAuto : f.totalCapAuto,
                routes: p.routes !== undefined ? p.routes : f.routes
              };
            });
          }

          function updateRoute(i, patch) {
            setFormVal(function (f) {
              var routes = f.routes.slice();
              if (routes[i] === null || routes[i] === undefined) {
                routes[i] = { provider: '', model: '', cap: 1, tier: '', maxThinking: '', profile: emptyProfile() };
              }
              var nr = Object.assign({}, routes[i], patch);
              if (patch.profile) {
                nr.profile = Object.assign({}, (nr.profile || {}), patch.profile);
              }
              routes[i] = nr;
              return { enabled: f.enabled, totalCap: f.totalCap, totalCapAuto: f.totalCapAuto, routes: routes };
            });
          }

          function updateProfile(i, field, value) {
            setFormVal(function (f) {
              var routes = f.routes.slice();
              if (routes[i] === null || routes[i] === undefined) {
                routes[i] = { provider: '', model: '', cap: 1, tier: '', maxThinking: '', profile: emptyProfile() };
              }
              var prof = Object.assign({}, (routes[i].profile || {}), { [field]: value });
              routes[i] = Object.assign({}, routes[i], { profile: prof });
              return { enabled: f.enabled, totalCap: f.totalCap, totalCapAuto: f.totalCapAuto, routes: routes };
            });
          }

          function addRoute() {
            var idx = formVal.routes.length;
            setFormVal(function (f) {
              var routes = f.routes.slice();
              routes.push({ provider: '', model: '', cap: 1, tier: '', maxThinking: '', profile: emptyProfile() });
              return { enabled: f.enabled, totalCap: f.totalCap, totalCapAuto: f.totalCapAuto, routes: routes };
            });
            setOpenVal(function (o) { var n = Object.assign({}, o); n[idx] = true; return n; });
          }

          function toggleRoute(i, cap) {
            if (cap > 0) { lastCapRef.current[i] = cap; updateRoute(i, { cap: 0 }); }
            else { updateRoute(i, { cap: lastCapRef.current[i] || 1 }); }
          }

          // Exact replica of the GUI's own switch (._switch_1ik0f_5):
          // 36x20 track, 2px inset, 16px thumb, translate(16px) when on.
          function Switch(props) {
            return React.createElement('button', {
              type: 'button', role: 'switch', 'aria-checked': props.on ? 'true' : 'false',
              'aria-label': props.label || 'Toggle',
              title: props.title || (props.on ? 'Enabled — click to disable' : 'Disabled — click to enable'),
              disabled: !!props.disabled,
              onClick: props.onClick,
              style: {
                boxSizing: 'border-box', position: 'relative', flex: '0 0 auto',
                width: 36, height: 20, padding: 2, border: 0, borderRadius: 999,
                background: props.on ? T.brand : T.switchOff,
                cursor: props.disabled ? 'default' : 'pointer',
                opacity: props.disabled ? 0.5 : 1
              }
            }, React.createElement('span', {
              style: {
                display: 'block', width: 16, height: 16, borderRadius: '50%',
                background: props.on ? T.thumbOn : T.thumbOff,
                transform: props.on ? 'translate(16px)' : 'none',
                transition: 'transform .12s ease'
              }
            }));
          }

          // Native <select> wrapped in the app's field styling + chevron.
          function Sel(props) {
            return React.createElement('span', { className: 'dsp-selwrap', style: props.wrapStyle || null },
              React.createElement('select', {
                className: 'dsp-select',
                style: props.style || null,
                disabled: props.disabled,
                value: props.value,
                title: props.title,
                onChange: props.onChange
              }, props.children),
              React.createElement('span', { className: 'dsp-selchev', 'aria-hidden': true }, '▾')
            );
          }

          function removeRoute(i) {
            setFormVal(function (f) {
              var routes = f.routes.slice();
              routes.splice(i, 1);
              return { enabled: f.enabled, totalCap: f.totalCap, totalCapAuto: f.totalCapAuto, routes: routes };
            });
          }

          function refresh() {
            return fetchJson('/subagent-pool/status')
              .then(function (s) {
                setErrVal(null);
                setStatusVal(s);
                setFormVal(function (f) {
                  if (f && Array.isArray(f.routes) && f.routes.length > 0) {
                    return f;
                  }
                  if (s && Array.isArray(s.routes) && s.routes.length > 0) {
                    return {
                      enabled: s.enabled === true,
                      totalCap: typeof s.totalCapStored === 'number' ? s.totalCapStored : (typeof s.totalCap === 'number' ? s.totalCap : 2),
                      totalCapAuto: s.totalCapAuto === true,
                      routes: s.routes.map(normRoute)
                    };
                  }
                  return { enabled: false, totalCap: 2, totalCapAuto: false, routes: DEFAULT_ROUTES.map(normRoute) };
                });
              })
              .catch(function (e) {
                setErrVal(e && e.message ? e.message : String(e));
              });
          }

          function loadCatalog() {
            return fetchJson('/subagent-pool/models')
              .then(function (res) {
                if (res && res.ok === true) { setCatalogVal(res); setCatalogErrVal(null); }
                else setCatalogErrVal(res && res.error ? res.error : 'model catalog unavailable');
              })
              .catch(function (e) {
                setCatalogErrVal(e && e.message ? e.message : String(e));
              });
          }

          function configure(patch) {
            setBusyVal(true);
            setLastErrorVal(null);
            var f = formRef.current;
            if (f && f.state && f.state.status === 'ready' && typeof f.mutate === 'function') {
              // Standard path: atomic volatile write to our own entry.
              var cur = f.state.value || {};
              var ops = [
                { op: 'set', path: ['enabled'], value: patch.enabled === true },
                { op: 'set', path: ['totalCap'], value: patch.totalCap },
                { op: 'set', path: ['totalCapAuto'], value: patch.totalCapAuto === true },
                { op: 'set', path: ['queueMaxWaitSec'], value: typeof cur.queueMaxWaitSec === 'number' ? cur.queueMaxWaitSec : 300 },
                { op: 'set', path: ['queueMaxLen'], value: Number.isInteger(cur.queueMaxLen) ? cur.queueMaxLen : 20 },
                { op: 'set', path: ['routes'], value: patch.routes }
              ];
              f.mutate(ops, f.state.revision)
                .then(function (ok) {
                  if (ok === true) { refresh(); } else { setLastErrorVal('settings rejected the write'); }
                })
                .catch(function (e) { setLastErrorVal(e && e.message ? e.message : String(e)); })
                .then(function () { setBusyVal(false); });
              return;
            }
            configureApi(patch)
              .then(function (res) {
                if (res && res.ok === true) {
                  if (res.status) setStatusVal(res.status);
                } else {
                  setLastErrorVal(res && res.error ? res.error : 'configure failed');
                }
              })
              .catch(function (e) {
                setLastErrorVal(e && e.message ? e.message : String(e));
              })
              .then(function () {
                setBusyVal(false);
              });
          }

          // Adopt the entry's current values as the form's initial state when
          // the host supplies a form (row page); the /status poll below still
          // fills the form when no form prop is present.
          React.useEffect(function () {
            var f = formRef.current;
            if (!f || !f.state || f.state.status !== 'ready' || !f.state.value) return;
            var v = f.state.value;
            setFormVal(function (cur2) {
              if (cur2.routes.length > 0) return cur2;
              return {
                enabled: v.enabled === true,
                totalCap: typeof v.totalCap === 'number' ? v.totalCap : 2,
                totalCapAuto: v.totalCapAuto === true,
                routes: Array.isArray(v.routes) && v.routes.length > 0 ? v.routes.map(normRoute) : cur2.routes
              };
            });
          }, [props && props.form && props.form.state]);

          React.useEffect(function () {
            refresh();
            loadCatalog();
            var timer = setInterval(refresh, 3000);
            return function () { clearInterval(timer); };
          }, []);

          var infoKeys = formVal.routes
            .map(function (r) { return (r && r.provider && r.model) ? r.provider + '/' + r.model : ''; })
            .filter(Boolean)
            .join('|');

          React.useEffect(function () {
            if (!infoKeys) {
              setInfoMapVal({});
              return;
            }
            var keys = infoKeys.split('|');
            for (var i = 0; i < keys.length; i++) {
              var k = keys[i];
              if (infoMapVal[k] !== undefined || inflight[k]) continue;
              inflight[k] = true;
              var slash = k.indexOf('/');
              var provider = k.slice(0, slash);
              var model = k.slice(slash + 1);
              fetchJson('/subagent-pool/model-info?provider=' + encodeURIComponent(provider) + '&model=' + encodeURIComponent(model))
                .then(function (res) {
                  setInfoMapVal(function (m) {
                    var n = {};
                    for (var p in m) { if (m.hasOwnProperty(p)) n[p] = m[p]; }
                    n[k] = res;
                    return n;
                  });
                })
                .catch(function (e) {
                  setInfoMapVal(function (m) {
                    var n = {};
                    for (var p in m) { if (m.hasOwnProperty(p)) n[p] = m[p]; }
                    n[k] = { ok: false, error: e && e.message ? e.message : String(e) };
                    return n;
                  });
                })
                .then(function () { delete inflight[k]; });
            }
          }, [infoKeys]);

          var useSelects = (catalogVal && catalogVal.ok === true);

          // Gate every action until the config has actually loaded (status
          // poll answered or the host form is ready) — no edits against a
          // blank form.
          var formReady = !!(formRef.current && formRef.current.state && formRef.current.state.status === 'ready' && formRef.current.state.value);
          var loaded = !!statusVal || formReady;
          ensureCss();
          if (!loaded) {
            return React.createElement('div', { style: { maxWidth: 720, padding: 16, fontSize: 13, color: T.muted, fontFamily: 'inherit' } },
              'Loading configuration…');
          }

          function providerOptions(c, current) {
            if (!c || c.ok !== true || !Array.isArray(c.providers)) return [''];
            var ids = c.providers.map(function (p) { return p.id; });
            if (ids.indexOf(current) === -1 && current) ids.push(current);
            return ids;
          }

          function modelOptions(c, prov, model) {
            if (!c || c.ok !== true || !Array.isArray(c.providers)) return [];
            var out = [];
            for (var i = 0; i < c.providers.length; i++) {
              if (c.providers[i].id !== prov) continue;
              if (!Array.isArray(c.providers[i].models) || !c.providers[i].models.length) continue;
              for (var j = 0; j < c.providers[i].models.length; j++) {
                out.push(c.providers[i].models[j].id);
              }
            }
            if (model && out.indexOf(model) === -1) out.push(model);
            return out;
          }

          var smallMuted = { fontSize: 11, color: T.muted };
          // auto total cap = sum of enabled route caps (min 1)
          var autoCap = formVal.routes.reduce(function (sum, r) {
            var c = r && Number(r.cap);
            return sum + (Number.isFinite(c) && c > 0 ? c : 0);
          }, 0);
          if (autoCap < 1) autoCap = 1;
          var badgeStyle = {
            display: 'inline-block',
            borderRadius: 6,
            padding: '2px 8px',
            fontSize: 11,
            fontWeight: 'bold'
          };

          var statusBadge = null;
          if (statusVal) {
            var badgeLabel = statusVal.enabled ? 'ACTIVE' : 'INACTIVE';
            var badgeColor = statusVal.enabled ? T.ok : T.err;
            statusBadge = React.createElement('span', { key: 'badge', style: Object.assign({}, badgeStyle, { color: T.primaryFg, background: badgeColor }) }, badgeLabel);
          }

          var card = [];

          card.push(React.createElement('h3', { key: 'title', style: { margin: 0, fontSize: 15, color: T.text } }, 'Subagent Pool'));

          if (statusBadge) {
            card.push(React.createElement('div', { key: 'badges', style: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 } },
              statusBadge,
              React.createElement('span', { key: 'running', style: smallMuted },
                'Running: ' +
                (statusVal && statusVal.totalRunning != null ? statusVal.totalRunning : 0) + ' / ' +
                (statusVal && statusVal.totalCap != null ? statusVal.totalCap : 2) +
                (statusVal && statusVal.totalCapAuto ? ' (auto)' : '')
              )
            ));
            if (statusVal && statusVal.inactiveReason) {
              card.push(React.createElement('div', { key: 'inactive-reason', style: { color: T.warn, fontSize: 12, marginTop: 4 } }, statusVal.inactiveReason));
            }
          }

          var chipStyle = 'dsp-chip';
          if (statusVal && Array.isArray(statusVal.routes) && statusVal.routes.length > 0) {
            card.push(React.createElement('div', { key: 'routes-h', className: 'dsp-h', style: { marginTop: 12 } }, 'Routes'));
            for (var ri = 0; ri < statusVal.routes.length; ri++) {
              var sr = statusVal.routes[ri];
              var sp = (sr && sr.profile && typeof sr.profile === 'object') ? sr.profile : {};
              card.push(React.createElement('div', { key: 'sr-' + ri, className: 'dsp-card', style: { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 } },
                React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' } },
                  React.createElement('span', { style: { fontWeight: 'bold', color: T.text, fontSize: 12, flex: '1 1 160px', minWidth: 0, overflowWrap: 'anywhere' } }, (sr.provider || '') + '/' + (sr.model || '')),
                  React.createElement('span', { key: 'stats', className: chipStyle }, 'cap ' + (sr.cap !== undefined ? sr.cap : 1) + ' · running ' + (sr.running || 0) + ' · idle ' + (sr.idle || 0)),
                  (sr.tier ? React.createElement('span', { key: 'tier', className: chipStyle }, sr.tier) : null)
                ),
                React.createElement('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap' } },
                  React.createElement('span', { key: 'mt', className: chipStyle }, 'max-thinking: ' + (sr.maxThinking || 'none')),
                  React.createElement('span', { key: 'best', className: chipStyle }, 'good for: ' + (sp.bestFor || '—')),
                  React.createElement('span', { key: 'avoid', className: chipStyle }, 'avoid: ' + (sp.avoidFor || '—')),
                  React.createElement('span', { key: 'notes', className: chipStyle }, 'notes: ' + (sp.notes || '—'))
                )
              ));
            }
          }

          if (statusVal && statusVal.queue) {
            var q = statusVal.queue;
            card.push(React.createElement('div', { key: 'queue', className: 'dsp-card', style: { marginTop: 8, padding: 8 } },
              React.createElement('div', { style: { fontSize: 12, color: T.text, fontWeight: 'bold' } },
                'Queue: ' + (q.total || 0) + ' waiting (max len ' + (q.maxLen || 20) + ', wait ' + (q.maxWaitSec || 300) + ' s)'),
              (q.waiting && q.waiting.length > 0) ? React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4 } },
                q.waiting.map(function (w, idx) {
                  var routeLabel = (w && w.route) || '';
                  var waitingSec = (w && w.waitingSec) || 0;
                  return React.createElement('div', { key: 'q-' + idx, style: { display: 'flex', gap: 6, fontSize: 11, color: T.muted, alignItems: 'center' } },
                    React.createElement('span', { style: { fontWeight: 'bold' } }, routeLabel),
                    React.createElement('span', { className: 'dsp-chip' }, waitingSec + 's')
                  );
                })
              ) : React.createElement('div', { style: { fontSize: 11, color: T.muted, marginTop: 4 } }, 'Queue empty')
            ));
          }

          card.push(React.createElement('div', { key: 'form-h', className: 'dsp-h', style: { marginTop: 16, paddingTop: 12, borderTop: '1px solid ' + T.border } }, 'Configure'));
          card.push(React.createElement('div', { key: 'form', style: { display: 'flex', flexDirection: 'column', gap: 10 } }));
          card.push(React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', fontSize: 13, color: T.text } },
            React.createElement('label', { style: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' } },
              React.createElement(Switch, {
                on: formVal.enabled === true,
                label: 'Pool enabled',
                title: formVal.enabled ? 'Pool enabled — click to disable' : 'Pool disabled — click to enable',
                onClick: function () { patchForm({ enabled: formVal.enabled !== true }); }
              }),
              'Enabled'
            ),
            React.createElement('label', { style: { display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' } },
              'Total cap',
              React.createElement('input', {
                type: 'number',
                min: 0,
                value: formVal.totalCapAuto ? autoCap : formVal.totalCap,
                disabled: formVal.totalCapAuto === true,
                title: formVal.totalCapAuto ? 'Auto: sum of route caps' : 'Maximum concurrent subagents',
                className: 'dsp-input', style: { width: 56 },
                onChange: function (e) { patchForm({ totalCap: capNum(e.target.value) }); }
              })
            ),
            React.createElement('label', { style: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' } },
              React.createElement(Switch, {
                on: formVal.totalCapAuto === true,
                label: 'Total cap auto',
                title: 'Auto: total cap = sum of route caps (' + autoCap + ')',
                onClick: function () { patchForm({ totalCapAuto: formVal.totalCapAuto !== true }); }
              }),
              React.createElement('span', { className: 'dsp-label', style: { fontSize: 13 } }, 'auto = ' + autoCap)
            )
          ));

          // NOTE: `let`, not `var` — every row's onChange/onClick closure below
          // captures this loop index; with `var` they all saw the final value
          // (routes.length), so row controls wrote to a phantom out-of-range
          // index (appending junk rows) and Remove was a no-op.
          for (let i = 0; i < formVal.routes.length; i++) {
            var r = formVal.routes[i];
            if (r === null || r === undefined) {
              r = { provider: '', model: '', cap: 1, tier: '', maxThinking: '', profile: emptyProfile() };
            }
            var p = (r.profile && typeof r.profile === 'object') ? r.profile : emptyProfile();
            var info = infoMapVal[(r.provider || '') + '/' + (r.model || '')];
            var efforts = (info && info.ok === true && info.reasoning) ? info.reasoning.efforts : [];

            var line1 = [];
            if (useSelects) {
              var pvOpts = providerOptions(catalogVal, r.provider);
              var pvOptsArr = [];
              for (var vi = 0; vi < pvOpts.length; vi++) {
                pvOptsArr.push(React.createElement('option', { key: pvOpts[vi], value: pvOpts[vi] }, pvOpts[vi]));
              }
              var pvSel = React.createElement(Sel, {
                key: 'pv',
                value: r.provider,
                title: r.provider || 'provider',
                onChange: function (e) { updateRoute(i, { provider: e.target.value, model: '', maxThinking: '' }); }
              }, pvOptsArr);
              line1.push(pvSel);

              var mo = modelOptions(catalogVal, r.provider, r.model);
              var moArr = [];
              moArr.push(React.createElement('option', { key: '__empty', value: '' }, '— model —'));
              for (var mi = 0; mi < mo.length; mi++) {
                moArr.push(React.createElement('option', { key: mo[mi], value: mo[mi] }, mo[mi]));
              }
              var mdSel = React.createElement(Sel, {
                key: 'md',
                value: r.model,
                title: r.model || 'model',
                onChange: function (e) { updateRoute(i, { model: e.target.value, maxThinking: '' }); }
              }, moArr);
              line1.push(mdSel);
            } else {
              line1.push(React.createElement('input', {
                key: 'pv',
                type: 'text',
                value: r.provider,
                placeholder: 'provider',
                className: 'dsp-input',
                onChange: function (e) { updateRoute(i, { provider: e.target.value, maxThinking: '' }); }
              }));
              line1.push(React.createElement('input', {
                key: 'md',
                type: 'text',
                value: r.model,
                placeholder: 'model',
                className: 'dsp-input',
                onChange: function (e) { updateRoute(i, { model: e.target.value, maxThinking: '' }); }
              }));
            }
            line1.push(React.createElement('input', {
              key: 'cp',
              type: 'number',
              min: 0,
              value: r.cap,
              className: 'dsp-input',
              onChange: function (e) { updateRoute(i, { cap: capNum(e.target.value) }); }
            }));
            line1.push(React.createElement('button', {
              key: 'rm',
              type: 'button',
              className: 'dsp-iconbtn',
              onClick: function () { removeRoute(i); },
              title: 'Remove route',
              'aria-label': 'Remove route'
            }, '\u00D7'));

            var mtOpts = efforts.length > 0 ? efforts.map(function (e) { return e.id; }) : EFFORT_LADDER.slice();
            if (r.maxThinking && mtOpts.indexOf(r.maxThinking) === -1) mtOpts.push(r.maxThinking);
            var mtArr = [];
            mtArr.push(React.createElement('option', { key: '__none', value: '' }, 'no thinking cap'));
            for (var ti = 0; ti < mtOpts.length; ti++) {
              var eff = null;
              for (var tj = 0; tj < efforts.length; tj++) { if (efforts[tj].id === mtOpts[ti]) { eff = efforts[tj]; break; } }
              var mtLabel = mtOpts[ti];
              if (eff && eff.name && eff.name !== mtOpts[ti]) mtLabel = mtOpts[ti] + ' \u2014 ' + eff.name;
              mtArr.push(React.createElement('option', { key: mtOpts[ti], value: mtOpts[ti] }, mtLabel));
            }
            var mtSel = React.createElement(Sel, {
              key: 'mt',
              value: r.maxThinking,
              title: 'max thinking',
              onChange: function (e) { updateRoute(i, { maxThinking: e.target.value }); }
            }, mtArr);
            var line2 = [mtSel];

            var ptArr = [];
            ptArr.push(React.createElement('option', { key: '', value: '' }, 'thinking: —'));
            for (var tki = 0; tki < THINKING_OPTS.length; tki++) {
              ptArr.push(React.createElement('option', { key: THINKING_OPTS[tki], value: THINKING_OPTS[tki] }, THINKING_OPTS[tki]));
            }
            var ptSel = React.createElement(Sel, {
              key: 'pt',
              value: p.thinking,
              onChange: function (e) { updateProfile(i, 'thinking', e.target.value); }
            }, ptArr);
            var psArr = [];
            psArr.push(React.createElement('option', { key: '', value: '' }, 'speed: —'));
            for (var ski = 0; ski < SPEED_OPTS.length; ski++) {
              psArr.push(React.createElement('option', { key: SPEED_OPTS[ski], value: SPEED_OPTS[ski] }, SPEED_OPTS[ski]));
            }
            var psSel = React.createElement(Sel, {
              key: 'ps',
              value: p.speed,
              onChange: function (e) { updateProfile(i, 'speed', e.target.value); }
            }, psArr);
            var piArr = [];
            piArr.push(React.createElement('option', { key: '', value: '' }, 'instructions: —'));
            for (var ipi = 0; ipi < INSTRUCTIONS_OPTS.length; ipi++) {
              piArr.push(React.createElement('option', { key: INSTRUCTIONS_OPTS[ipi], value: INSTRUCTIONS_OPTS[ipi] }, INSTRUCTIONS_OPTS[ipi]));
            }
            var piSel = React.createElement(Sel, {
              key: 'pi',
              value: p.instructions,
              onChange: function (e) { updateProfile(i, 'instructions', e.target.value); }
            }, piArr);
            var line3 = [ptSel, psSel, piSel];

            var line4 = [
              React.createElement('input', {
                key: 'pb',
                type: 'text',
                value: p.bestFor,
                placeholder: 'good for…',
                className: 'dsp-input',
                onChange: function (e) { updateProfile(i, 'bestFor', e.target.value); }
              }),
              React.createElement('input', {
                key: 'pa',
                type: 'text',
                value: p.avoidFor,
                placeholder: 'avoid…',
                className: 'dsp-input',
                onChange: function (e) { updateProfile(i, 'avoidFor', e.target.value); }
              }),
              React.createElement('input', {
                key: 'pn',
                type: 'text',
                value: p.notes,
                placeholder: 'notes (optional)',
                className: 'dsp-input',
                onChange: function (e) { updateProfile(i, 'notes', e.target.value); }
              })
            ];

            var isOpen = openVal[i] === true;
            var capOn = Number(r.cap) > 0;
            var sw = React.createElement(Switch, {
              on: capOn,
              label: (r.provider || 'route') + '/' + (r.model || '') + (capOn ? ' enabled' : ' disabled'),
              title: capOn ? 'Route enabled — click to disable (cap 0)' : 'Route disabled — click to enable',
              onClick: function () { toggleRoute(i, Number(r.cap) || 0); }
            });
            var chev = React.createElement('button', {
              type: 'button',
              className: 'dsp-iconbtn',
              title: isOpen ? 'Collapse details' : 'Expand details',
              'aria-label': isOpen ? 'Collapse route details' : 'Expand route details',
              onClick: function () { setOpenVal(function (o) { var n = Object.assign({}, o); n[i] = !isOpen; return n; }); }
            }, isOpen ? '\u25BE' : '\u25B8');
            var capBox = React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6 } },
              React.createElement('span', { className: 'dsp-label' }, 'cap'),
              line1[2]
            );
            var panel = [React.createElement('div', { key: 'hdr', style: { display: 'grid', gridTemplateColumns: '36px minmax(0,0.85fr) minmax(0,1.6fr) 96px 28px 28px', gap: 10, alignItems: 'center' } },
              sw, line1[0], line1[1], capBox, chev, line1[3]
            )];
            if (isOpen) {
              panel.push(React.createElement('div', { key: 'det', style: { marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--dsw-alias-border-l1)', display: 'flex', flexDirection: 'column', gap: 8 } },
                React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '110px 190px', gap: 8, alignItems: 'center' } },
                  React.createElement('span', { className: 'dsp-label' }, 'max thinking'),
                  line2[0]
                ),
                React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 8 } },
                  line3[0], line3[1], line3[2]
                ),
                React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 8 } },
                  line4[0], line4[1], line4[2]
                )
              ));
            }
            card.push(React.createElement('div', { key: 'fr-' + i, className: 'dsp-card', style: { marginTop: 8 } }, panel));
          }

          card.push(React.createElement('div', { key: 'actions', style: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, flexWrap: 'wrap' } },
            React.createElement('button', {
              key: 'add-route',
              className: 'dsp-btn dsp-btn-ghost',
              onClick: function () { addRoute(); }
            }, '+ Add route'),
            React.createElement('button', {
              key: 'save',
              className: 'dsp-btn dsp-btn-primary',
              disabled: busyVal,
              onClick: function () {
                var auto = formVal.totalCapAuto === true;
                configure({
                  enabled: formVal.enabled,
                  totalCap: auto ? autoCap : formVal.totalCap,
                  totalCapAuto: auto,
                  routes: formVal.routes
                });
              }
            }, busyVal ? 'Saving…' : 'Save'),
            lastErrorVal ? React.createElement('span', { key: 'last-err', style: { fontSize: 12, color: T.err } }, lastErrorVal) : null
          ));

          return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 720, padding: 16, fontSize: 13, color: T.text, fontFamily: 'inherit' } }, card);
        };
      }

      var react;
      try {
        react = require('react');
      } catch (e) {
        react = null;
      }

      var Card = react ? CardFactory(react) : null;

      function apply(ctx) {
        if (typeof ctx.inject !== "function") {
          return;
        }
        ctx.inject(["slots"], function (scope) {
          try {
            var slots = scope.slots;
            if (!slots) return;
            if (!Card) {
              console.error('[subagent-pool] React not available, card skipped');
              return;
            }
            // Render the card on this bundle's detail page in the Plugins
            // screen: v0.2.2-rc.1 renders `plugins.bundle.config` keyed by the
            // bundle package name with view 'page' (plugin-manager client.js).
            // The previous targets (settings.plugin.item,
            // settings.agentPresets.configurable) are not declared slots in
            // this version, so the card never rendered anywhere.
            scope.slots.inject("plugins.bundle.config", function* () {
              yield scope.slots.register(
                { name: 'plugins.bundle.config', id: NAME, key: 'dsh-subagent-pool', order: 10 },
                function (props) { return Card(props); }
              );
            });
            // Standard third-party config page: the row page inside the bundle
            // (Plugins -> dsh-subagent-pool -> subagent-pool row) renders
            // plugins.row.config keyed "<pkg>#<rowId>" and passes
            // form = { state, mutate } for this entry's Config schema — the
            // cookbook path (form.state / form.mutate, volatile hot-apply).
            scope.slots.inject("plugins.row.config", function* () {
              yield scope.slots.register(
                { name: 'plugins.row.config', id: NAME, key: 'dsh-subagent-pool#subagent-pool', order: 10 },
                function (props) { return Card(props); }
              );
            });
            // Also give the pool a page inside Settings -> Built-in plugins
            // (documented slot contract: settings.plugins.tab, list, options
            // id/order/label; the section owner renders label as the tab).
            scope.slots.inject("settings.plugins.tab", function* () {
              yield scope.slots.register(
                { name: 'settings.plugins.tab', id: 'subagent-pool', order: 60, label: 'Subagent Pool' },
                function (props) { return Card(props); }
              );
            });
          } catch (err) {
            console.error('[subagent-pool] register failed:', err);
          }
        });
      }

      exports.apply = apply;
      exports.__card = { factory: CardFactory };
      exports.name = NAME;
      exports.inject = ['slots'];
      return module.exports;
    }
  }
);
