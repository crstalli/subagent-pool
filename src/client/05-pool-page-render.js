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

