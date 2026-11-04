window.__ModuleLoader__.load(
  {
    id: "dsh-subagent-pool",
    factory: (require) => {
      var module = { exports: {} };
      var exports = module.exports;

      var NAME = "subagent-pool";
      var KEY = "subagent-pool";
      var ROUTE = "/subagent-pool";

      var T = {
        bg: 'var(--dsh-bg)',
        card: 'var(--dsh-card)',
        border: 'var(--dsh-border)',
        text: 'var(--dsh-text)',
        muted: 'var(--dsh-muted)',
        err: 'var(--dsh-error)',
        ok: 'var(--dsh-success)',
        warn: 'var(--dsh-warning)',
        primary: 'var(--dsh-primary)',
        field: 'var(--dsh-field)',
        input: 'var(--dsh-input)'
      };

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
        return function PoolPage() {
          var [statusVal, setStatusVal] = React.useState(null);
          var [errVal, setErrVal] = React.useState(null);
          var [formVal, setFormVal] = React.useState({ enabled: false, totalCap: 2, routes: [] });
          var [busyVal, setBusyVal] = React.useState(false);
          var [lastErrorVal, setLastErrorVal] = React.useState(null);
          var [catalogVal, setCatalogVal] = React.useState(null);
          var [catalogErrVal, setCatalogErrVal] = React.useState(null);
          var [infoMapVal, setInfoMapVal] = React.useState({});
          var inflight = {};

          function patchForm(p) {
            setFormVal(function (f) {
              return {
                enabled: p.enabled !== undefined ? p.enabled : f.enabled,
                totalCap: p.totalCap !== undefined ? p.totalCap : f.totalCap,
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
              return { enabled: f.enabled, totalCap: f.totalCap, routes: routes };
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
              return { enabled: f.enabled, totalCap: f.totalCap, routes: routes };
            });
          }

          function addRoute() {
            setFormVal(function (f) {
              var routes = f.routes.slice();
              routes.push({ provider: '', model: '', cap: 1, tier: '', maxThinking: '', profile: emptyProfile() });
              return { enabled: f.enabled, totalCap: f.totalCap, routes: routes };
            });
          }

          function removeRoute(i) {
            setFormVal(function (f) {
              var routes = f.routes.slice();
              routes.splice(i, 1);
              return { enabled: f.enabled, totalCap: f.totalCap, routes: routes };
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
                      totalCap: typeof s.totalCap === 'number' ? s.totalCap : 2,
                      routes: s.routes.map(normRoute)
                    };
                  }
                  return { enabled: false, totalCap: 2, routes: DEFAULT_ROUTES.map(normRoute) };
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
          var inputStyle = {
            background: T.input,
            border: '1px solid ' + T.border,
            borderRadius: 4,
            padding: '5px 8px',
            fontSize: 13,
            color: T.text,
            fontFamily: 'inherit'
          };
          var selectStyle = Object.assign({}, inputStyle, { appearance: 'none', cursor: 'pointer', paddingRight: 18 });
          var btnStyle = {
            background: T.primary,
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            padding: '6px 12px',
            fontSize: 13,
            cursor: 'pointer',
            fontFamily: 'inherit'
          };
          var badgeStyle = {
            display: 'inline-block',
            borderRadius: 3,
            padding: '1px 5px',
            fontSize: 11,
            fontWeight: 'bold'
          };

          var statusBadge = null;
          if (statusVal) {
            var badgeLabel = statusVal.enabled ? 'ACTIVE' : 'INACTIVE';
            var badgeColor = statusVal.enabled ? T.ok : T.err;
            statusBadge = React.createElement('span', { key: 'badge', style: Object.assign({}, badgeStyle, { color: '#fff', background: badgeColor }) }, badgeLabel);
          }

          var card = [];

          card.push(React.createElement('h3', { key: 'title', style: { margin: 0, fontSize: 15, color: T.text } }, 'Subagent Pool'));

          if (statusBadge) {
            card.push(React.createElement('div', { key: 'badges', style: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 } },
              statusBadge,
              React.createElement('span', { key: 'running', style: smallMuted },
                'Running: ' +
                (statusVal && statusVal.totalRunning != null ? statusVal.totalRunning : 0) + ' / ' +
                (statusVal && statusVal.totalCap != null ? statusVal.totalCap : 2)
              )
            ));
            if (statusVal && statusVal.inactiveReason) {
              card.push(React.createElement('div', { key: 'inactive-reason', style: { color: T.warn, fontSize: 12, marginTop: 4 } }, statusVal.inactiveReason));
            }
          }

          if (statusVal && Array.isArray(statusVal.routes) && statusVal.routes.length > 0) {
            card.push(React.createElement('div', { key: 'routes-status', style: { marginTop: 8 } }));
            for (var ri = 0; ri < statusVal.routes.length; ri++) {
              var sr = statusVal.routes[ri];
              var sp = (sr && sr.profile && typeof sr.profile === 'object') ? sr.profile : {};
              card.push(React.createElement('div', { key: 'sr-' + ri, style: { display: 'flex', flexDirection: 'column', gap: 2, background: T.field, border: '1px solid ' + T.border, borderRadius: 6, padding: 8, marginTop: 4 } },
                React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6 } },
                  React.createElement('span', { style: { fontWeight: 'bold', color: T.text, fontSize: 12, width: 160, flexShrink: 0 } }, (sr.provider || '') + '/' + (sr.model || '')),
                  React.createElement('span', { style: smallMuted }, 'cap ' + (sr.cap !== undefined ? sr.cap : 1) + '  running ' + (sr.running || 0) + '/' + (sr.cap || 0) + '  idle ' + (sr.idle || 0)),
                  (sr.tier ? React.createElement('span', { key: 'tier', style: smallMuted }, '[' + sr.tier + ']') : null)
                ),
                React.createElement('div', { style: { display: 'flex', gap: 6, fontSize: 11, color: T.muted, flexWrap: 'wrap' } },
                  React.createElement('span', { key: 'mt', style: { background: T.border, borderRadius: 3, padding: '1px 4px' } }, 'max-thinking: ' + (sr.maxThinking || 'none')),
                  React.createElement('span', { key: 'best', style: { background: T.border, borderRadius: 3, padding: '1px 4px' } }, 'good for: ' + (sp.bestFor || '—')),
                  React.createElement('span', { key: 'avoid', style: { background: T.border, borderRadius: 3, padding: '1px 4px' } }, 'avoid: ' + (sp.avoidFor || '—')),
                  React.createElement('span', { key: 'notes', style: { background: T.border, borderRadius: 3, padding: '1px 4px' } }, 'notes: ' + (sp.notes || '—'))
                )
              ));
            }
          }

          if (statusVal && statusVal.queue) {
            var q = statusVal.queue;
            card.push(React.createElement('div', { key: 'queue', style: { marginTop: 8, background: T.field, border: '1px solid ' + T.border, borderRadius: 6, padding: 8 } },
              React.createElement('div', { style: { fontSize: 12, color: T.text, fontWeight: 'bold' } },
                'Queue: ' + (q.total || 0) + ' waiting (max len ' + (q.maxLen || 20) + ', wait ' + (q.maxWaitSec || 300) + ' s)'),
              (q.waiting && q.waiting.length > 0) ? React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4 } },
                q.waiting.map(function (w, idx) {
                  var routeLabel = (w && w.route) || '';
                  var waitingSec = (w && w.waitingSec) || 0;
                  return React.createElement('div', { key: 'q-' + idx, style: { display: 'flex', gap: 6, fontSize: 11, color: T.muted, alignItems: 'center' } },
                    React.createElement('span', { style: { fontWeight: 'bold' } }, routeLabel),
                    React.createElement('span', { style: { background: T.border, borderRadius: 3, padding: '1px 4px' } }, waitingSec + 's')
                  );
                })
              ) : React.createElement('div', { style: { fontSize: 11, color: T.muted, marginTop: 4 } }, 'Queue empty')
            ));
          }

          card.push(React.createElement('div', { key: 'form', style: { marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 } }));
          card.push(React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', fontSize: 13, color: T.text } },
            React.createElement('label', { style: { display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' } },
              React.createElement('input', {
                type: 'checkbox',
                checked: formVal.enabled,
                onChange: function (e) { patchForm({ enabled: e.target.checked !== false }); }
              }),
              'Enabled'
            ),
            React.createElement('label', { style: { display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' } },
              'Total cap',
              React.createElement('input', {
                type: 'number',
                min: 0,
                value: formVal.totalCap,
                style: Object.assign({}, inputStyle, { width: 56 }),
                onChange: function (e) { patchForm({ totalCap: capNum(e.target.value) }); }
              })
            )
          ));

          for (var i = 0; i < formVal.routes.length; i++) {
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
              var pvSel = React.createElement('select', {
                key: 'pv',
                value: r.provider,
                style: Object.assign({}, selectStyle, { flex: 1, minWidth: 110 }),
                onChange: function (e) { updateRoute(i, { provider: e.target.value, model: '', maxThinking: '' }); }
              }, pvOptsArr);
              line1.push(pvSel);

              var mo = modelOptions(catalogVal, r.provider, r.model);
              var moArr = [];
              moArr.push(React.createElement('option', { key: '__empty', value: '' }, '— model —'));
              for (var mi = 0; mi < mo.length; mi++) {
                moArr.push(React.createElement('option', { key: mo[mi], value: mo[mi] }, mo[mi]));
              }
              var mdSel = React.createElement('select', {
                key: 'md',
                value: r.model,
                style: Object.assign({}, selectStyle, { flex: 1.4, minWidth: 130 }),
                onChange: function (e) { updateRoute(i, { model: e.target.value, maxThinking: '' }); }
              }, moArr);
              line1.push(mdSel);
            } else {
              line1.push(React.createElement('input', {
                key: 'pv',
                type: 'text',
                value: r.provider,
                placeholder: 'provider',
                style: Object.assign({}, inputStyle, { flex: 1, minWidth: 110 }),
                onChange: function (e) { updateRoute(i, { provider: e.target.value, maxThinking: '' }); }
              }));
              line1.push(React.createElement('input', {
                key: 'md',
                type: 'text',
                value: r.model,
                placeholder: 'model',
                style: Object.assign({}, inputStyle, { flex: 1.4, minWidth: 130 }),
                onChange: function (e) { updateRoute(i, { model: e.target.value, maxThinking: '' }); }
              }));
            }
            line1.push(React.createElement('input', {
              key: 'cp',
              type: 'number',
              min: 0,
              value: r.cap,
              style: Object.assign({}, inputStyle, { width: 56, flexShrink: 0 }),
              onChange: function (e) { updateRoute(i, { cap: capNum(e.target.value) }); }
            }));
            line1.push(React.createElement('button', {
              key: 'rm',
              style: { background: 'none', border: 'none', color: T.err, cursor: 'pointer', fontSize: 14, padding: 0, width: 24, height: 24, borderRadius: 4 },
              onClick: function () { removeRoute(i); },
              title: 'Remove route'
            }, '\u2152'));

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
            var mtSel = React.createElement('select', {
              key: 'mt',
              value: r.maxThinking,
              style: Object.assign({}, selectStyle, { width: 150 }),
              onChange: function (e) { updateRoute(i, { maxThinking: e.target.value }); }
            }, mtArr);
            var line2 = [mtSel];

            var ptArr = [];
            ptArr.push(React.createElement('option', { key: '', value: '' }, 'thinking: —'));
            for (var tki = 0; tki < THINKING_OPTS.length; tki++) {
              ptArr.push(React.createElement('option', { key: THINKING_OPTS[tki], value: THINKING_OPTS[tki] }, THINKING_OPTS[tki]));
            }
            var ptSel = React.createElement('select', {
              key: 'pt',
              value: p.thinking,
              style: Object.assign({}, selectStyle, { flex: 1, minWidth: 90 }),
              onChange: function (e) { updateProfile(i, 'thinking', e.target.value); }
            }, ptArr);
            var psArr = [];
            psArr.push(React.createElement('option', { key: '', value: '' }, 'speed: —'));
            for (var ski = 0; ski < SPEED_OPTS.length; ski++) {
              psArr.push(React.createElement('option', { key: SPEED_OPTS[ski], value: SPEED_OPTS[ski] }, SPEED_OPTS[ski]));
            }
            var psSel = React.createElement('select', {
              key: 'ps',
              value: p.speed,
              style: Object.assign({}, selectStyle, { flex: 1, minWidth: 90 }),
              onChange: function (e) { updateProfile(i, 'speed', e.target.value); }
            }, psArr);
            var piArr = [];
            piArr.push(React.createElement('option', { key: '', value: '' }, 'instructions: —'));
            for (var ipi = 0; ipi < INSTRUCTIONS_OPTS.length; ipi++) {
              piArr.push(React.createElement('option', { key: INSTRUCTIONS_OPTS[ipi], value: INSTRUCTIONS_OPTS[ipi] }, INSTRUCTIONS_OPTS[ipi]));
            }
            var piSel = React.createElement('select', {
              key: 'pi',
              value: p.instructions,
              style: Object.assign({}, selectStyle, { flex: 1.3, minWidth: 110 }),
              onChange: function (e) { updateProfile(i, 'instructions', e.target.value); }
            }, piArr);
            var line3 = [ptSel, psSel, piSel];

            var line4 = [
              React.createElement('input', {
                key: 'pb',
                type: 'text',
                value: p.bestFor,
                placeholder: 'good for…',
                style: Object.assign({}, inputStyle, { width: '100%' }),
                onChange: function (e) { updateProfile(i, 'bestFor', e.target.value); }
              }),
              React.createElement('input', {
                key: 'pa',
                type: 'text',
                value: p.avoidFor,
                placeholder: 'avoid…',
                style: Object.assign({}, inputStyle, { width: '100%' }),
                onChange: function (e) { updateProfile(i, 'avoidFor', e.target.value); }
              }),
              React.createElement('input', {
                key: 'pn',
                type: 'text',
                value: p.notes,
                placeholder: 'notes (optional)',
                style: Object.assign({}, inputStyle, { width: '100%' }),
                onChange: function (e) { updateProfile(i, 'notes', e.target.value); }
              })
            ];

            card.push(React.createElement('div', { key: 'fr-' + i, style: { display: 'flex', flexDirection: 'column', gap: 6, border: '1px dashed ' + T.border, borderRadius: 8, padding: 10, background: T.field } },
              React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' } },
                React.createElement('span', { style: Object.assign({}, smallMuted, { width: 84, flexShrink: 0 }) }, 'route'),
                line1[0], line1[1], line1[2], line1[3]
              ),
              React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' } },
                React.createElement('span', { style: Object.assign({}, smallMuted, { width: 84, flexShrink: 0 }) }, 'max thinking'),
                line2[0]
              ),
              React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' } },
                React.createElement('span', { style: Object.assign({}, smallMuted, { width: 84, flexShrink: 0 }) }, 'profile'),
                line3[0], line3[1], line3[2]
              ),
              line4[0], line4[1], line4[2]
            ));
          }

          card.push(React.createElement('button', {
            key: 'add-route',
            style: Object.assign({}, btnStyle, { alignSelf: 'flex-start' }),
            onClick: function () { addRoute(); }
          }, '+ Add route'));

          card.push(React.createElement('button', {
            key: 'save',
            style: Object.assign({}, btnStyle, { alignSelf: 'flex-start' }),
            disabled: busyVal,
            onClick: function () { configure({ enabled: formVal.enabled, totalCap: formVal.totalCap, routes: formVal.routes }); }
          }, 'Save'));

          if (lastErrorVal) {
            card.push(React.createElement('div', { key: 'last-err', style: { fontSize: 12, color: T.err } }, lastErrorVal));
          }

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
            scope.slots.inject("settings.plugin.item", function* () {
              yield scope.slots.register(
                { name: 'settings.plugin.item', id: NAME, key: 'subagent-model-selection', order: 10 },
                Card
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
