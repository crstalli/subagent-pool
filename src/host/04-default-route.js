    // ---- default route (leaf reads only) ----
    function defaultRoute() {
      try {
        if (settings) {
          const v = settings.get(NS_DEFAULT);
          if (v && v.provider && v.model) return { provider: v.provider, model: v.model };
        }
      } catch (e) {}
      try {
        if (agentDefaultModel) {
          const s = agentDefaultModel.currentSelection();
          if (s && s.provider && s.model) return { provider: s.provider, model: s.model };
        }
      } catch (e) {}
      return { provider: 'qwen_local', model: 'qwen38_27b_medium' };
    }

