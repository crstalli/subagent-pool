    // ---- config validation (v2 fields are optional and lenient) ----
    function validateConfig(cfg) {
      if (!cfg || typeof cfg !== 'object') return 'config must be an object';
      if (typeof cfg.totalCap !== 'number' || !Number.isInteger(cfg.totalCap) || cfg.totalCap < 1) return 'totalCap must be a positive integer';
      if (!Array.isArray(cfg.routes) || cfg.routes.length < 1) return 'routes must be a non-empty array';
      const seen = new Set();
      for (let i = 0; i < cfg.routes.length; i++) {
        const r = cfg.routes[i];
        if (!r || typeof r !== 'object') return 'route must be an object';
        if (typeof r.provider !== 'string' || !r.provider.trim()) return 'route provider must be a non-empty string';
        if (typeof r.model !== 'string' || !r.model.trim()) return 'route model must be a non-empty string';
        if (typeof r.cap !== 'number' || !Number.isInteger(r.cap) || r.cap < 1) return 'route cap must be a positive integer';
        if (r.maxThinking !== undefined && r.maxThinking !== null) {
          if (typeof r.maxThinking !== 'string') return 'route maxThinking must be a string (empty = no cap)';
          if (r.maxThinking !== '' && effortRank(r.maxThinking) === -1) return 'route maxThinking must be one of: ' + EFFORTS.join(', ');
        }
        if (r.profile !== undefined && r.profile !== null) {
          if (typeof r.profile !== 'object' || Array.isArray(r.profile)) return 'route profile must be an object';
          const pf = r.profile;
          for (let j = 0; j < 6; j++) {
            const f = ['thinking', 'speed', 'instructions', 'bestFor', 'avoidFor', 'notes'][j];
            if (pf[f] !== undefined && pf[f] !== null && typeof pf[f] !== 'string') return 'profile.' + f + ' must be a string';
          }
        }
        const k = r.provider + '/' + r.model;
        if (seen.has(k)) return 'duplicate route ' + k;
        seen.add(k);
      }
      if (cfg.queueMaxWaitSec !== undefined && cfg.queueMaxWaitSec !== null) {
        if (typeof cfg.queueMaxWaitSec !== 'number' || !Number.isFinite(cfg.queueMaxWaitSec) || cfg.queueMaxWaitSec < 1) return 'queueMaxWaitSec must be a number >= 1';
      }
      if (cfg.queueMaxLen !== undefined && cfg.queueMaxLen !== null) {
        if (typeof cfg.queueMaxLen !== 'number' || !Number.isInteger(cfg.queueMaxLen) || cfg.queueMaxLen < 1) return 'queueMaxLen must be a positive integer';
      }
      return null;
    }

    // ---- fs load / write ----
    function loadConfig() {
      if (!fs) return Promise.resolve({ config: null, enabled: false, reason: 'fs service unavailable' });
      return fs.resolve(CONFIG_PATH).then(function (t) { return fs.readText(t); }).then(function (content) {
        let cfg;
        try { cfg = JSON.parse(content); } catch (e) { return { config: null, enabled: false, reason: 'config is not valid JSON' }; }
        const verr = validateConfig(cfg);
        if (verr) return { config: null, enabled: false, reason: 'config invalid: ' + verr };
        if (cfg.enabled !== true) return { config: cfg, enabled: false, reason: 'config enabled is not true' };
        return { config: cfg, enabled: true, reason: '' };
      }).catch(function () {
        return { config: null, enabled: false, reason: 'config not found/unreadable: ' + CONFIG_PATH };
      });
    }
    function writeConfig(cfg) {
      if (!fs) return Promise.reject(new Error('fs service unavailable'));
      // omitting `expected` => unconditional atomic create-or-overwrite
      return fs.resolve(CONFIG_PATH).then(function (t) { return fs.writeText(t, JSON.stringify(cfg, null, 2)); });
    }

