    // ---- run ----
    registerEffects();
    registerRpc();
    boot().catch(function (e) { log('pool: boot failed: ' + e); });
  }
};
