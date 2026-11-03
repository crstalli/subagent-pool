    function PoolPage(props) {
      const close = props && typeof props.close === 'function' ? props.close : null;
      const [status, setStatus] = React.useState(null);
      const [error, setError] = React.useState(null);
      const [form, setForm] = React.useState({ enabled: false, totalCap: 2, routes: [] });
      const [busy, setBusy] = React.useState(false);
      const [lastError, setLastError] = React.useState(null);
      const [catalog, setCatalog] = React.useState(null);       // {providers:[...]}
      const [catalogError, setCatalogError] = React.useState(null);
      const [infoMap, setInfoMap] = React.useState({});          // "p/m" -> modelInfo result

      function patchForm(p) {
        setForm(function (f) {
          return {
            enabled: p.enabled !== undefined ? p.enabled : f.enabled,
            totalCap: p.totalCap !== undefined ? p.totalCap : f.totalCap,
            routes: p.routes !== undefined ? p.routes : f.routes,
          };
        });
      }

      function updateRoute(i, patch) {
        setForm(function (f) {
          const routes = f.routes.slice();
          routes[i] = Object.assign({}, routes[i], patch);
          return { enabled: f.enabled, totalCap: f.totalCap, routes: routes };
        });
      }

      function updateProfile(i, field, value) {
        setForm(function (f) {
          const routes = f.routes.slice();
          routes[i] = Object.assign({}, routes[i], { profile: Object.assign({}, routes[i].profile, { [field]: value }) });
          return { enabled: f.enabled, totalCap: f.totalCap, routes: routes };
        });
      }

      // Poll: plain-JSON status only touches state; failures keep last good status.
      function refresh() {
        return host.call('pool.status', undefined)
          .then(function (s) {
            setError(null);
            setStatus(s);
            setForm(function (f) {
              if (f.routes.length > 0) return f; // never clobber in-progress user edits
              if (s && Array.isArray(s.routes) && s.routes.length > 0) {
                return {
                  enabled: s.enabled === true,
                  totalCap: typeof s.totalCap === 'number' ? s.totalCap : 2,
                  routes: s.routes.map(normRoute),
                };
              }
              return { enabled: false, totalCap: 2, routes: DEFAULT_ROUTES.map(normRoute) };
            });
          })
          .catch(function (e) {
            setError(e && e.message ? e.message : String(e));
          });
      }

      function loadCatalog() {
        return host.call('pool.models', undefined)
          .then(function (res) {
            if (res && res.ok === true) { setCatalog(res); setCatalogError(null); }
            else setCatalogError(res && res.error ? res.error : 'model catalog unavailable');
          })
          .catch(function (e) {
            setCatalogError(e && e.message ? e.message : String(e));
          });
      }

      // Lazy-fetch exact model info (reasoning efforts) per configured route.
      const infoKeys = form.routes
        .map(function (r) { return (r.provider && r.model) ? r.provider + '/' + r.model : ''; })
        .filter(Boolean)
        .join('|');
      React.useEffect(function () {
        if (!infoKeys) return;
        const keys = infoKeys.split('|');
        for (let i = 0; i < keys.length; i++) {
          const k = keys[i];
          if (infoMap[k] !== undefined || inflight[k]) continue;
          const slash = k.indexOf('/');
          const provider = k.slice(0, slash);
          const model = k.slice(slash + 1);
          inflight[k] = true;
          host.call('pool.modelInfo', { provider: provider, model: model })
            .then(function (res) {
              setInfoMap(function (m) { const n = Object.assign({}, m); n[k] = res; return n; });
            })
            .catch(function (e) {
              setInfoMap(function (m) {
                const n = Object.assign({}, m);
                n[k] = { ok: false, error: e && e.message ? e.message : String(e) };
                return n;
              });
            })
            .then(function () { delete inflight[k]; });
        }
      }, [infoKeys]);

      function configure(patch) {
        setBusy(true);
        setLastError(null);
        host.call('pool.configure', patch)
          .then(function (res) {
            if (!res || res.ok !== true) {
              setLastError(res && res.error ? res.error : 'configure failed');
              return;
            }
            if (res.status) setStatus(res.status);
          })
          .catch(function (e) {
            setLastError(e && e.message ? e.message : String(e));
          })
          .then(function () {
            setBusy(false);
          });
      }

      React.useEffect(function () {
        refresh();
        loadCatalog();
        return ctx.interval(function () { refresh(); }, 3000);
      }, []);

      const s = status;
      const enabled = !!(s && s.enabled);
      const liveRoutes = s && Array.isArray(s.routes) ? s.routes : [];
      const useSelects = catalogError === null;
      const rows = [];

