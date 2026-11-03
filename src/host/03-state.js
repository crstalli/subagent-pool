    // ---- live pool state (single source of truth) ----
    let config = null;      // full config object once loaded
    let enabled = false;    // actively enforcing
    let reason = 'starting';// inactive reason
    const tracked = new Map(); // agentId -> {id, route:{provider,model}, status}

    // ---- queue state (in-memory only; lost on restart) ----
    let queue = [];     // FIFO: {id, route, key, since, totalOnly, resolve, settled, stopTimer, onAbort, signal}
    let nextQid = 1;

    function queueMaxWaitMs() {
      if (config && typeof config.queueMaxWaitSec === 'number' && config.queueMaxWaitSec >= 1) return config.queueMaxWaitSec * 1000;
      return 300 * 1000;
    }
    function queueMaxLen() {
      if (config && Number.isInteger(config.queueMaxLen) && config.queueMaxLen >= 1) return config.queueMaxLen;
      return 20;
    }

