// Subagent Pool — static host half (boot bundle).
// ESM cordis plugin: exports name, inject, apply.
// Ported from pool-host-v4.js dynamic plugin.

import { resolve as pathResolve } from 'node:path';
import Schema from '@deepseek-ai/schemastery';

export const name = 'subagent-pool';
export const inject = ['webServer'];

// Declared Config schema: this makes the `subagent-pool` loader entry a
// *configurable plugin entry* (docs/user/develop/basic/config.md). The entry
// then (a) accepts config from cordis.yml, (b) is editable through the
// Settings GUI / `settings.update('subagent-pool', patch)`, and (c) shows up
// in the plugin manager's configure views. All top-level fields are volatile,
// so settings.update() applies them live without a plugin reload; the pool
// reads them via .get() (see readLive below). subagent_pool_config.json stays
// as a persistence mirror written by the /configure endpoint and imported at
// boot when present.
const RouteProfileSchema = Schema.object({
  thinking: Schema.string().default(''),
  speed: Schema.string().default(''),
  instructions: Schema.string().default(''),
  bestFor: Schema.string().default(''),
  avoidFor: Schema.string().default(''),
  notes: Schema.string().default('')
}).default({});
const RouteSchema = Schema.object({
  provider: Schema.string().min(1).required(),
  model: Schema.string().min(1).required(),
  cap: Schema.natural().default(1),
  tier: Schema.string().default(''),
  maxThinking: Schema.string().default(''),
  profile: RouteProfileSchema
});
// Schema is deliberately permissive at load time (the shipped cordis.patch.yml
// row uses enabled:false / totalCap:0 as the off state); runtime semantics
// (totalCap >= 1, non-empty routes) stay enforced by validateConfig().
export const Config = Schema.object({
  enabled: Schema.boolean().default(true).volatile(),
  totalCap: Schema.natural().default(2).volatile(),
  queueMaxWaitSec: Schema.number().min(0).default(300).volatile(),
  queueMaxLen: Schema.natural().default(20).volatile(),
  routes: Schema.array(RouteSchema).default([]).volatile()
});

export function apply(ctx, config) {
  // ---- log helper ----
  const log = function (m) { try { console.log(m); } catch (e) {} };

  // Config path: relative to plugin install directory for portability
  // In ESM, use import.meta.url to resolve __dirname equivalent
  const __dirname = pathResolve(new URL('.', import.meta.url).pathname);
  const CONFIG_PATH = pathResolve(__dirname, 'subagent_pool_config.json');
  // Registered by @deepseek-ai/dsh-tool-subagent (model-selection-settings.js
  // exports name = 'subagent-model-selection-settings'); settings.update() takes
  // the profile entry id, so this must match exactly or every write throws
  // "No configurable plugin entry".
  const NS_SELECTION = 'subagent-model-selection-settings';
  const NS_DEFAULT = 'agent-default-model';

  // Canonical thinking-effort ladder
  const EFFORTS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'];
  function effortRank(id) {
    const i = EFFORTS.indexOf(id);
    return i;
  }

  // ---- live pool state ----
  let configState = null;
  let enabled = false;
  let reason = 'starting';
  const tracked = new Map();

  // Live Config-entry handle (exported `Config` above). Volatile fields arrive
  // as Volatile handles with .get(); plain values are used as-is. `cs()` is the
  // single read path for pool state so edits made through the Settings GUI /
  // settings.update('subagent-pool', …) take effect without a plugin reload.
  let liveCfg = config; // live Config-entry handles (declared `Config` schema above)
  function field(f, dflt) {
    const v = liveCfg ? liveCfg[f] : undefined;
    if (v === undefined || v === null) return dflt;
    return (typeof v.get === 'function') ? v.get() : v;
  }
  function readLive() {
    if (!liveCfg) return null;
    const cfg = {
      version: 3,
      enabled: field('enabled', true) === true,
      totalCap: field('totalCap', 2),
      queueMaxWaitSec: field('queueMaxWaitSec', 300),
      queueMaxLen: field('queueMaxLen', 20),
      routes: field('routes', [])
    };
    if (validateConfig(cfg)) return null; // invalid live value: keep last good
    return cfg;
  }
  // Adopt a (validated) config as the running state.
  function adopt(cfg, opts) {
    configState = cfg;
    enabled = (cfg.enabled === true);
    reason = enabled ? '' : 'disabled by configure';
    if (!opts || opts.namespace !== false) {
      if (enabled) applyNamespace(); else restoreNamespace();
    }
    processQueue();
  }
  // Set once the settings entry has been synced with our persisted JSON at
  // boot (or the entry is authoritative because no JSON existed); before that,
  // cs() must not adopt entry defaults over the just-loaded JSON.
  let entrySynced = false;
  // Read path used everywhere below: syncs from the live entry when it changed
  // (e.g. an edit made in the Settings GUI), then returns the running state.
  function cs() {
    if (entrySynced) {
      const live = readLive();
      if (live && JSON.stringify(live) !== JSON.stringify(configState)) {
        adopt(live, { namespace: true });
        writeConfig(live).catch(function () {}); // keep the JSON mirror in sync
      }
    }
    return configState;
  }

  // ---- queue state (in-memory only) ----
  let queue = [];
  let nextQid = 1;

  function queueMaxWaitMs() {
    if (cs() && typeof cs().queueMaxWaitSec === 'number' && cs().queueMaxWaitSec >= 1)
      return cs().queueMaxWaitSec * 1000;
    return 300 * 1000;
  }
  function queueMaxLen() {
    if (cs() && Number.isInteger(cs().queueMaxLen) && cs().queueMaxLen >= 1)
      return cs().queueMaxLen;
    return 20;
  }

  // ---- scoped service refs ----
  // fs is not a dsh service in the web profile — use Node built-ins directly.
  const fsPromises = import('node:fs/promises').then(m => m);
  let settings = null;
  let agents = null;
  let systemPrompt = null;
  let agentDefaultModel = null;
  let llm = null;
  let timer = null;
  let webServer = null;

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

  // ---- config validation (v3 schema) ----
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
      if (typeof r.cap !== 'number' || !Number.isInteger(r.cap) || r.cap < 0) return 'route cap must be a non-negative integer (0 = disabled)';
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

  // ---- fs load / write (via node:fs/promises, not the dsh fs service) ----
  function loadConfig() {
    return fsPromises.then(function (fsP) {
      const resolved = pathResolve(CONFIG_PATH);
      return fsP.readFile(resolved, 'utf8').then(function (content) {
        let cfg;
        try { cfg = JSON.parse(content); } catch (e) { return { config: null, enabled: false, reason: 'config is not valid JSON' }; }
        const verr = validateConfig(cfg);
        if (verr) return { config: null, enabled: false, reason: 'config invalid: ' + verr };
        if (cfg.enabled !== true) return { config: cfg, enabled: false, reason: 'config enabled is not true' };
        return { config: cfg, enabled: true, reason: '' };
      }).catch(function () {
        return { config: null, enabled: false, reason: 'config not found/unreadable: ' + CONFIG_PATH };
      });
    });
  }
  function writeConfig(cfg) {
    return fsPromises.then(function (fsP) {
      const resolved = pathResolve(CONFIG_PATH);
      return fsP.writeFile(resolved, JSON.stringify(cfg, null, 2), { encoding: 'utf8' });
    });
  }

  // ---- accounting ----
  function isSubagent(agent) {
    return !!(agent && agent.session && agent.session.header && agent.session.header.origin === 'subagent');
  }
  function routeFor(agent) {
    const o = (agent && agent.options) ? agent.options : {};
    if (o.provider && o.model) return { provider: o.provider, model: o.model };
    const hdr = (agent && agent.session && agent.session.header) ? agent.session.header : {};
    if (hdr.parentSession && agents) {
      try {
        const p = agents.get(hdr.parentSession);
        if (p && p.options && p.options.provider && p.options.model) return { provider: p.options.provider, model: p.options.model };
      } catch (e) {}
    }
    return defaultRoute();
  }
  function counts() {
    const byRoute = {};
    let totalRunning = 0;
    const vals = tracked.values();
    for (const info of vals) {
      const k = info.route.provider + '/' + info.route.model;
      if (!byRoute[k]) byRoute[k] = { running: 0, idle: 0 };
      if (info.status === 'running') { byRoute[k].running++; totalRunning++; }
      else byRoute[k].idle++;
    }
    return { byRoute: byRoute, totalRunning: totalRunning };
  }

  // ---- agent lifecycle listeners ----
  function onCreated(p) {
    const a = p && p.agent;
    if (!isSubagent(a) || !a.id || tracked.has(a.id)) return;
    tracked.set(a.id, { id: a.id, route: routeFor(a), status: 'idle' });
    processQueue();
  }
  function onStatus(p) {
    const a = p && p.agent;
    if (!isSubagent(a) || !a.id) return;
    const st = (p && p.status) || 'idle';
    if (tracked.has(a.id)) tracked.get(a.id).status = st;
    else tracked.set(a.id, { id: a.id, route: routeFor(a), status: st });
    processQueue();
  }
  function onDisposed(p) {
    const a = p && p.agent;
    if (a && a.id) tracked.delete(a.id);
    processQueue();
  }

  // ---- guard helpers ----
  function findRoute(route) {
    if (!cs() || !Array.isArray(cs().routes)) return undefined;
    for (let i = 0; i < cs().routes.length; i++) {
      const r = cs().routes[i];
      if (r.provider === route.provider && r.model === route.model) return r;
    }
    return undefined;
  }
  function listRoutes() {
    if (!cs() || !Array.isArray(cs().routes)) return 'none';
    return cs().routes.map(function (r) { return r.provider + '/' + r.model; }).join(', ');
  }
  function requestedRoute(args) {
    const a = (args && typeof args === 'object') ? args : {};
    if (typeof a.provider === 'string' && a.provider !== '' && typeof a.model === 'string' && a.model !== '') {
      return { provider: a.provider, model: a.model };
    }
    return defaultRoute();
  }
  function effortDecision(route, routeCfg, args) {
    if (!routeCfg) return null;
    const mt = (typeof routeCfg.maxThinking === 'string') ? routeCfg.maxThinking : '';
    if (mt === '') return null;
    const a = (args && typeof args === 'object') ? args : {};
    const effort = (typeof a.reasoning_effort === 'string') ? a.reasoning_effort : '';
    if (effort === '') return null;
    const er = effortRank(effort);
    const mr = effortRank(mt);
    if (er === -1 || mr === -1) return null;
    if (er > mr) {
      return { kind: 'deny', reason: 'Subagent pool: ' + route.provider + '/' + route.model + ' caps thinking at "' + mt + '" (you requested "' + effort + '"). Retry with reasoning_effort at or below "' + mt + '", or pick another route.' };
    }
    return null;
  }

  // ---- queue management ----
  function settleEntry(e, value) {
    if (e.settled) return;
    e.settled = true;
    if (e.stopTimer) { try { e.stopTimer(); } catch (err2) {} e.stopTimer = null; }
    if (e.signal && e.onAbort && typeof e.signal.removeEventListener === 'function') {
      try { e.signal.removeEventListener('abort', e.onAbort); } catch (err2) {}
    }
    const i = queue.indexOf(e);
    if (i !== -1) queue.splice(i, 1);
    e.resolve(value);
  }

  function flushQueue(msg) {
    const q = queue.slice();
    queue.length = 0;
    for (let i = 0; i < q.length; i++) settleEntry(q[i], { kind: 'deny', reason: 'Subagent pool: ' + msg });
  }

  function processQueue() {
    if (!enabled || !cs() || queue.length === 0) return;
    const c = counts();
    let totalRunning = c.totalRunning;
    const admitted = {};
    let admittedTotal = 0;
    for (let i = 0; i < queue.length; i++) {
      const e = queue[i];
      const rcfg = findRoute(e.route);
      if (!rcfg || rcfg.cap <= 0) {
        log('pool: queue reject ' + e.key + ' (route disabled or removed)');
        settleEntry(e, { kind: 'deny', reason: 'Subagent pool: route ' + e.key + ' is disabled (cap 0) or removed; use a configured route.' });
        i--;
        continue;
      }
      if (e.totalOnly) {
        if (totalRunning + admittedTotal < cs().totalCap) {
          log('pool: queue admit total (waited ' + Math.round((Date.now() - e.since) / 1000) + 's)');
          settleEntry(e, null);
          i--;
        }
        continue;
      }
      const rk = (c.byRoute[e.key] ? c.byRoute[e.key].running : 0) + (admitted[e.key] || 0);
      if (rk >= rcfg.cap || totalRunning + admittedTotal >= cs().totalCap) continue;
      admitted[e.key] = (admitted[e.key] || 0) + 1;
      admittedTotal++;
      log('pool: queue admit ' + e.key + ' (waited ' + Math.round((Date.now() - e.since) / 1000) + 's)');
      settleEntry(e, null);
      i--;
    }
  }

  function waitInQueue(route, key, signal, totalOnly) {
    if (!timer || typeof timer.timeout !== 'function') {
      return Promise.resolve({ kind: 'deny', reason: 'Subagent pool: at capacity and queueing unavailable (timer service missing); wait and retry.' });
    }
    if (queue.length >= queueMaxLen()) {
      return Promise.resolve({ kind: 'deny', reason: 'Subagent pool: queue is full (' + queue.length + ' waiting); try another route or retry in a moment.' });
    }
    return new Promise(function (resolve) {
      const e = {
        id: nextQid++,
        route: route,
        key: key,
        since: Date.now(),
        totalOnly: !!totalOnly,
        resolve: resolve,
        settled: false,
        stopTimer: null,
        onAbort: null,
        signal: null
      };
      if (signal && typeof signal === 'object') {
        if (signal.aborted === true) {
          queue.push(e);
          settleEntry(e, { kind: 'deny', reason: 'Subagent pool: request was already aborted.' });
          return;
        }
        if (typeof signal.addEventListener === 'function') {
          e.signal = signal;
          e.onAbort = function () {
            log('pool: queue abort ' + e.key);
            settleEntry(e, { kind: 'deny', reason: 'Subagent pool: request was aborted while waiting in the queue.' });
          };
          try { signal.addEventListener('abort', e.onAbort); } catch (err2) { e.signal = null; e.onAbort = null; }
        }
      }
      const maxWait = queueMaxWaitMs();
      e.stopTimer = timer.timeout(function () {
        log('pool: queue timeout ' + e.key + ' after ' + Math.round(maxWait / 1000) + 's');
        settleEntry(e, { kind: 'deny', reason: 'Subagent pool: waited ' + Math.round(maxWait / 1000) + 's in queue and no slot freed; retry later or use another route.' });
      }, maxWait);
      queue.push(e);
      log('pool: queue wait ' + key + ' (queue now ' + queue.length + ')');
      processQueue();
    });
  }

  // Async guard for the waterfall
  function guardAsync(exec) {
    if (!enabled || !cs()) return Promise.resolve(null);
    const name = exec && exec.name;
    if (name === 'subagent' || name === 'subagent_fork') {
      const route = requestedRoute(exec && exec.arguments);
      const key = route.provider + '/' + route.model;
      const rcfg = findRoute(route);
      if (!rcfg) {
        return Promise.resolve({ kind: 'deny', reason: 'Subagent pool: ' + key + ' is not a configured route; use ' + listRoutes() + '.' });
      }
      const ed = effortDecision(route, rcfg, exec && exec.arguments);
      if (ed) return Promise.resolve(ed);
      const c = counts();
      const rc = c.byRoute[key] ? c.byRoute[key].running : 0;
      if (rcfg.cap <= 0) return Promise.resolve({ kind: 'deny', reason: 'Subagent pool: route ' + route.provider + '/' + route.model + ' has cap 0 (disabled).' });
      if (rc < rcfg.cap && c.totalRunning < cs().totalCap) return Promise.resolve(null);
      return waitInQueue(route, key, exec && exec.signal, false);
    }
    if (name === 'workflow' || name === 'ralph') {
      const c = counts();
      if (c.totalRunning < cs().totalCap) return Promise.resolve(null);
      return waitInQueue(defaultRoute(), 'total', exec && exec.signal, true);
    }
    return Promise.resolve(null);
  }

  // ---- status payload ----
  function routeView(r) {
    const c = counts();
    const k = r.provider + '/' + r.model;
    const x = c.byRoute[k] || { running: 0, idle: 0 };
    const v = {
      provider: r.provider, model: r.model, cap: r.cap,
      tier: r.tier,
      maxThinking: (typeof r.maxThinking === 'string') ? r.maxThinking : '',
      profile: null,
      running: x.running, idle: x.idle
    };
    if (r.profile && typeof r.profile === 'object') {
      v.profile = {
        thinking: r.profile.thinking || '',
        speed: r.profile.speed || '',
        instructions: r.profile.instructions || '',
        bestFor: r.profile.bestFor || '',
        avoidFor: r.profile.avoidFor || '',
        notes: r.profile.notes || ''
      };
    }
    return v;
  }
  function statusPayload() {
    const c = counts();
    const out = { enabled: enabled };
    if (cs() && Array.isArray(cs().routes)) {
      out.totalCap = cs().totalCap;
      out.totalRunning = c.totalRunning;
      out.routes = cs().routes.map(routeView);
      out.queue = {
        total: queue.length,
        maxLen: queueMaxLen(),
        maxWaitSec: Math.round(queueMaxWaitMs() / 1000),
        perRoute: {},
        waiting: []
      };
      for (let i = 0; i < queue.length; i++) {
        const e = queue[i];
        const k = e.totalOnly ? 'total-cap' : e.key;
        out.queue.perRoute[k] = (out.queue.perRoute[k] || 0) + 1;
        out.queue.waiting.push({ id: e.id, route: k, waitingSec: Math.round((Date.now() - e.since) / 1000) });
      }
    }
    if (!enabled) out.inactiveReason = reason;
    return out;
  }

  // ---- settings namespace ----
  let prevSelection = null;
  let hasPrev = false;
  let nsActivated = false;
  function savePrevSelection() {
    try {
      if (settings) { const desc = settings.describe().find(r => r.ns === NS_SELECTION); if (desc) { prevSelection = desc.value; hasPrev = !!prevSelection; } }
    } catch (e) {}
  }
  function applyNamespace(retry) {
    if (!settings || !cs()) return Promise.resolve();
    if (!nsActivated) savePrevSelection();
    nsActivated = true;
    const allowedModels = cs().routes.map(function (r) { return { provider: r.provider, model: r.model }; });
    return settings.update(NS_SELECTION, { enabled: true, allowedModels: allowedModels }).then(function () {
      log('pool: namespace applied (' + NS_SELECTION + ', ' + allowedModels.length + ' routes)');
    }).catch(function (e) {
      log('pool: namespace update failed: ' + e);
      // The owning entry may not be registered yet when the pool activates;
      // retry briefly instead of silently dropping the steering.
      if ((retry || 0) < 10) setTimeout(function () { applyNamespace((retry || 0) + 1); }, 3000);
    });
  }
  function restoreNamespace() {
    if (!settings || !nsActivated) return Promise.resolve();
    nsActivated = false;
    const patch = (hasPrev && prevSelection)
      ? { enabled: !!prevSelection.enabled, allowedModels: prevSelection.allowedModels || [] }
      : { enabled: false, allowedModels: [] };
    return settings.update(NS_SELECTION, patch).catch(function (e) { log('pool: namespace restore failed: ' + e); });
  }

  // ---- boot ----
  // Push the persisted JSON into the now-configurable `subagent-pool` entry so
  // the Settings GUI / cordis.yml view shows the live pool config (one-time
  // migration for installs that predate the Config schema).
  function pushEntry(cfg, retry) {
    if (!settings) return Promise.resolve(false);
    const patch = {
      enabled: cfg.enabled === true,
      totalCap: cfg.totalCap,
      queueMaxWaitSec: cfg.queueMaxWaitSec,
      queueMaxLen: cfg.queueMaxLen,
      routes: cfg.routes
    };
    return settings.update(name, patch).then(function () {
      log('pool: settings entry applied (subagent-pool)');
      return true;
    }).catch(function (e) {
      log('pool: settings entry update failed: ' + e);
      if ((retry || 0) < 10) return new Promise(function (res) {
        setTimeout(function () { res(pushEntry(cfg, (retry || 0) + 1)); }, 3000);
      });
      return false;
    });
  }
  function boot() {
    return loadConfig().then(function (res) {
      const finish = function () {
        // Entry is authoritative from here on; cs() picks up GUI edits live.
        entrySynced = true;
        const live = readLive();
        if (live) { adopt(live, { namespace: false }); } else { configState = res.config; enabled = res.enabled; reason = res.reason; }
        log('pool: ' + (enabled ? 'active' : 'inactive') + (reason ? ' (' + reason + ')' : ''));
        if (enabled) applyNamespace(); else restoreNamespace();
        processQueue();
        return null;
      };
      if (res.config) {
        // JSON exists: migrate it into the settings entry, then read live.
        return pushEntry(res.config, 0).then(finish);
      }
      return finish();
    });
  }

  // ---- register side effects (reversible via ctx.effect) ----
  function registerEffects() {
    ctx.on('agent/created', onCreated);
    ctx.on('agent/status', onStatus);
    ctx.on('agent/disposed', onDisposed);
    ctx.on('agent/error', function (p) {
      if (p && p.agent && p.agent.id) processQueue();
    });

    ctx.on('tools/pre-execute', function (exec, next) {
      return guardAsync(exec)
        .then(function (d) {
          if (d !== null) return d;
          return next();
        })
        .catch(function (e) {
          return { kind: 'deny', reason: 'Subagent pool guard error: ' + (e && e.message ? e.message : String(e)) };
        });
    });

    if (systemPrompt) {
      systemPrompt.section({
        name: 'subagent-pool',
        order: 1000,
        text: function () {
          if (!enabled || !cs()) return '';
          const lines = [];
          lines.push('Subagent pool active: max ' + cs().totalCap + ' concurrent. Routes (pick the one that fits the task):');
          for (let i = 0; i < cs().routes.length; i++) {
            const r = cs().routes[i];
            const p = r.profile || {};
            const cap = (typeof r.maxThinking === 'string' && r.maxThinking !== '') ? 'max thinking ' + r.maxThinking : 'no thinking cap';
            const desc = [];
            if (p.bestFor) desc.push('good for: ' + p.bestFor);
            if (p.avoidFor) desc.push('avoid: ' + p.avoidFor);
            if (p.thinking) desc.push('thinking=' + p.thinking);
            if (p.speed) desc.push('speed=' + p.speed);
            if (p.instructions) desc.push('instructions: ' + p.instructions);
            if (p.notes) desc.push(p.notes);
            lines.push('- ' + r.provider + '/' + r.model + ' (cap ' + r.cap + ', ' + cap + ')' + (desc.length ? ': ' + desc.join('; ') : ''));
          }
          if (queue.length > 0) {
            const parts = {};
            for (let i = 0; i < queue.length; i++) {
              const k = queue[i].totalOnly ? 'total-cap' : queue[i].key;
              parts[k] = (parts[k] || 0) + 1;
            }
            const desc = [];
            for (const k in parts) desc.push(parts[k] + ' on ' + k);
            lines.push('Queue: ' + queue.length + ' request(s) waiting (' + desc.join(', ') + '). At-capacity requests wait for a free slot (up to ' + Math.round(queueMaxWaitMs() / 1000) + 's each) and are admitted automatically as slots free.');
          }
          lines.push('Routing: prefer ' + listRoutes() + ' (profile above). Pick by task depth, not by availability. Unconfigured routes and over-cap thinking levels are denied; at-capacity routes wait in the queue automatically.');
          return lines.join('\n');
        }
      });
    }

    if (settings) {
      ctx.effect(function () {
        return function () { restoreNamespace().catch(function () {}); };
      }, 'subagent-pool-ns-restore');
    }

    if (timer && typeof timer.interval === 'function') {
      ctx.effect(function () {
        return timer.interval(function () { processQueue(); }, 5000);
      }, 'subagent-pool-queue-sweep');
    }

    ctx.effect(function () {
      return function () { flushQueue('stopped while request was waiting in the queue.'); };
    }, 'subagent-pool-queue-flush');
  }

  // ---- HTTP routes for the client half ----
  function registerRoutes() {
    if (!webServer) return;

    const send = function (res, status, body) {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };

    const readBody = function (req) {
      return new Promise(function (resolve) {
        const chunks = [];
        let total = 0;
        for (let c of req) {
          total += c.length;
          if (total > 64 * 1024) {
            req.destroy();
            resolve(undefined);
            return;
          }
          chunks.push(c);
        }
        resolve(Buffer.concat(chunks).toString('utf8'));
      });
    };

    // GET /subagent-pool/status
    webServer.register({
      name: 'pool-status',
      kind: 'exact',
      path: '/subagent-pool/status',
      handler: async function (req, res) {
        send(res, 200, statusPayload());
      }
    });

    // GET /subagent-pool/models
    webServer.register({
      name: 'pool-models',
      kind: 'exact',
      path: '/subagent-pool/models',
      handler: async function (req, res) {
        if (!llm) { send(res, 200, { ok: false, error: 'llm service unavailable' }); return; }
        let providers;
        try {
          providers = llm.listProviders();
        } catch (e) {
          send(res, 200, { ok: false, error: 'listProviders failed: ' + (e && e.message ? e.message : String(e)) });
          return;
        }
        const out = [];
        const pending = [];
        for (let i = 0; i < providers.length; i++) {
          const p = providers[i];
          const entry = { id: p.id, name: p.name || p.id, models: [] };
          out.push(entry);
          pending.push(
            llm.listModels(p.id).then(function (ms) {
              entry.models = ms.map(function (m) {
                return { id: m.id, name: m.name || m.id, description: m.description || '' };
              });
            }).catch(function (e) {
              entry.error = e && e.message ? e.message : String(e);
            })
          );
        }
        const result = await Promise.all(pending).then(function () { return { ok: true, providers: out }; });
        send(res, 200, result);
      }
    });

    // GET /subagent-pool/model-info?provider=X&model=Y
    webServer.register({
      name: 'pool-model-info',
      kind: 'exact',
      path: '/subagent-pool/model-info',
      handler: async function (req, res) {
        if (!llm) { send(res, 200, { ok: false, error: 'llm service unavailable' }); return; }
        var url = new URL(req.url, 'http://localhost');
        var p = url.searchParams.get('provider') || '';
        var m = url.searchParams.get('model') || '';
        if (typeof p !== 'string' || p === '' || typeof m !== 'string' || m === '') {
          send(res, 200, { ok: false, error: 'provider and model are required' });
          return;
        }
        try {
          const info = await llm.resolveModelInfo(p, m);
          const out = {
            ok: true,
            model: info.id,
            name: info.name || info.id,
            contextWindow: (info.context && typeof info.context.contextWindow === 'number') ? info.context.contextWindow : null,
            defaultMaxTokens: (typeof info.defaultMaxTokens === 'number') ? info.defaultMaxTokens : null,
            reasoning: null
          };
          if (info.reasoning && typeof info.reasoning === 'object') {
            out.reasoning = {
              efforts: (info.reasoning.efforts || []).map(function (e) {
                return { id: e.id, name: e.name || e.id, description: e.description || '' };
              }),
              defaultEffort: info.reasoning.defaultEffort || null
            };
          }
          send(res, 200, out);
        } catch (e) {
          send(res, 200, { ok: false, error: e && e.message ? e.message : String(e) });
        }
      }
    });

    // GET /subagent-pool/configure?config=BASE64
    webServer.register({
      name: 'pool-configure',
      kind: 'exact',
      path: '/subagent-pool/configure',
      handler: async function (req, res) {
        var url = new URL(req.url, 'http://localhost');
        var configB64 = url.searchParams.get('config') || '';
        var r = {};
        if (configB64) {
          try { r = JSON.parse(Buffer.from(configB64, 'base64').toString('utf8')); } catch (e) {}
        }
        const base = cs() || { version: 1, enabled: false, totalCap: 1, routes: [] };
        const next = {
          version: 3,
          enabled: r.enabled !== undefined ? (r.enabled === true) : (base ? base.enabled === true : true),
          totalCap: r.totalCap !== undefined ? r.totalCap : base.totalCap,
          queueMaxWaitSec: r.queueMaxWaitSec !== undefined ? r.queueMaxWaitSec : (typeof base.queueMaxWaitSec === 'number' ? base.queueMaxWaitSec : 300),
          queueMaxLen: r.queueMaxLen !== undefined ? r.queueMaxLen : (Number.isInteger(base.queueMaxLen) ? base.queueMaxLen : 20),
          routes: r.routes !== undefined ? r.routes : base.routes
        };
        const verr = validateConfig(next);
        if (verr) { send(res, 200, { ok: false, error: 'invalid config: ' + verr }); return; }
        try {
          await writeConfig(next); // JSON mirror (persistence / back-compat)
          entrySynced = true;
          // Standard mechanism: write the plugin's own configurable entry so the
          // Settings GUI and cordis.yml view stay in sync (volatile = live).
          if (settings) {
            await settings.update(name, {
              enabled: next.enabled === true,
              totalCap: next.totalCap,
              queueMaxWaitSec: next.queueMaxWaitSec,
              queueMaxLen: next.queueMaxLen,
              routes: next.routes
            }).catch(function (e) { log('pool: settings entry update failed: ' + e); });
          }
          adopt(next, { namespace: true });
          if (!enabled) flushQueue('disabled while request was waiting in the queue.');
          send(res, 200, { ok: true, status: statusPayload() });
        } catch (e) {
          send(res, 200, { ok: false, error: 'write failed: ' + (e && e.message ? e.message : String(e)) });
        }
      }
    });
  }

  // ---- register everything via scoped inject ----


  ctx.inject(['settings'], (scope) => {
    settings = scope.settings;
  });

  ctx.inject(['agents'], (scope) => {
    agents = scope.agents;
  });

  ctx.inject(['systemPrompt'], (scope) => {
    systemPrompt = scope.systemPrompt;
  });

  ctx.inject(['agentDefaultModel'], (scope) => {
    agentDefaultModel = scope.agentDefaultModel;
  });

  ctx.inject(['llm'], (scope) => {
    llm = scope.llm;
  });

  ctx.inject(['timer'], (scope) => {
    timer = scope.timer;
  });

  ctx.inject(['webServer'], (scope) => {
    webServer = scope.webServer;
    try {
      registerRoutes(scope);
    } catch (error) {
      log('pool: route registration failed: ' + error);
    }
  });

  // NOTE: this plugin now declares `export const Config` above, which makes its
  // loader entry (`subagent-pool`) a configurable plugin entry. The pool writes
  // it via settings.update('subagent-pool', …) on boot (migrating the persisted
  // subagent_pool_config.json) and on every /configure save; subagent_pool_config.json
  // remains as the on-disk mirror. Reads go through cs(), which picks up live
  // entry edits (Settings GUI / cordis.yml) via the volatile field handles.

  registerEffects();
  boot().catch(function (e) { log('pool: boot failed: ' + e); });
}
