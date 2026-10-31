    // ---- namespace apply / restore ----
    let prevSelection = null;
    let hasPrev = false;
    let nsActivated = false;
    function savePrevSelection() {
      try {
        if (settings) { prevSelection = settings.get(NS_SELECTION); hasPrev = !!prevSelection; }
      } catch (e) {}
    }
    function applyNamespace() {
      if (!settings || !config) return Promise.resolve();
      if (!nsActivated) savePrevSelection(); // save prev only on first activation
      nsActivated = true;
      const allowedModels = config.routes.map(function (r) { return { provider: r.provider, model: r.model }; });
      return settings.update(NS_SELECTION, { enabled: true, allowedModels: allowedModels }).catch(function (e) { log('pool: namespace update failed: ' + e); });
    }
    function restoreNamespace() {
      if (!settings || !nsActivated) return Promise.resolve();
      nsActivated = false;
      const patch = (hasPrev && prevSelection)
        ? { enabled: !!prevSelection.enabled, allowedModels: prevSelection.allowedModels || [] }
        : { enabled: false, allowedModels: [] };
      return settings.update(NS_SELECTION, patch).catch(function (e) { log('pool: namespace restore failed: ' + e); });
    }

