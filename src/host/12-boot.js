    // ---- boot ----
    function boot() {
      return loadConfig().then(function (res) {
        config = res.config;
        enabled = res.enabled;
        reason = res.reason;
        log('pool: ' + (enabled ? 'active' : 'inactive') + (reason ? ' (' + reason + ')' : ''));
        if (enabled) applyNamespace();
        processQueue();
        return null;
      });
    }

