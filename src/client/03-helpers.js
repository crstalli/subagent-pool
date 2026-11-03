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

