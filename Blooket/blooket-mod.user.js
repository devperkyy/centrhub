// ==UserScript==
// @name         blooket tower mod
// @namespace    centrhub
// @version      0.2.0
// @description  tower defense menu: redux scan, state dump, max towers, tokens, hotkeys, config
// @match        https://www.blooket.com/*
// @match        https://blooket.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

// uses the react-redux store that the page already holds, found by walking
// the react fiber tree from the DOM. nothing is injected into the bundle.
// HOOKS below are the only game-specific part. they are null until one SCAN
// run tells you the state shape and action types. fill them, reload, done.

(() => {
  'use strict';

  const log = (...a) => console.log('[dolp]', ...a);

  // FILL: state -> [{ id, level, maxLevel }]  (paths come from SCAN output)
  // FILL: state -> number
  // FILL: (id, level) => redux action object
  // FILL: (n) => redux action object
  const HOOKS = {
    getTowers: s => [],
    getTokens: s => 0,
    setTowerLevel: null,
    setTokens: null,
  };

  const DEFAULTS = { tokenAmount: 999999, auto: false, autoTokens: false, scanDepth: 8 };
  const CFG_KEY = 'dolp-blooket-cfg';
  const POS_KEY = 'dolp-blooket-pos';
  const cfg = { ...DEFAULTS };
  try { Object.assign(cfg, JSON.parse(localStorage.getItem(CFG_KEY)) || {}); } catch (_) {}
  const saveCfg = () => { try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch (_) {} };

  let store = null;

  function findStore() {
    for (const el of document.querySelectorAll('body *')) {
      const k = Object.keys(el).find(x => x.startsWith('__reactFiber$'));
      if (!k) continue;
      for (let f = el[k]; f; f = f.return) {
        const s = f.memoizedProps && f.memoizedProps.store;
        if (s && typeof s.getState === 'function' && typeof s.dispatch === 'function') return s;
      }
    }
    return null;
  }

  // walks the state, returns paths of anything that looks like a tower list,
  // a level number or a token count
  function scan(state) {
    const hits = [];
    const seen = new WeakSet();
    const walk = (o, path, depth) => {
      if (!o || typeof o !== 'object' || depth > cfg.scanDepth || seen.has(o)) return;
      seen.add(o);
      for (const k of Object.keys(o)) {
        const v = o[k];
        const p = path ? `${path}.${k}` : k;
        if (/tower/i.test(k) && v && typeof v === 'object') hits.push(`[tower-ish] ${p}`);
        if (k === 'level' && typeof v === 'number') hits.push(`[level] ${p} = ${v}`);
        if (k === 'tokens' && typeof v === 'number') hits.push(`[tokens] ${p} = ${v}`);
        walk(v, p, depth + 1);
      }
    };
    walk(state, '', 0);
    return hits;
  }

  // full state as json, cycle-safe. kept on window for console access too
  function dumpState(state) {
    const seen = new WeakSet();
    const json = JSON.stringify(state, (k, v) => {
      if (v && typeof v === 'object') {
        if (seen.has(v)) return '[cycle]';
        seen.add(v);
      }
      return typeof v === 'function' ? '[fn]' : v;
    }, 2);
    window.__dolpState = state;
    return json;
  }

  function hookDispatch() {
    if (store.__dolpHooked) return;
    store.__dolpHooked = true;
    const real = store.dispatch;
    store.dispatch = a => {
      log('dispatch', a && a.type, a);
      return real(a);
    };
  }

  function applyMax() {
    if (!store) return log('no store yet');
    if (!HOOKS.setTowerLevel) return log('HOOKS.setTowerLevel is null. run SCAN, fill HOOKS, reload.');
    for (const t of HOOKS.getTowers(store.getState())) {
      if (t.level < t.maxLevel) store.dispatch(HOOKS.setTowerLevel(t.id, t.maxLevel));
    }
  }

  function applyTokens() {
    if (!store) return log('no store yet');
    if (!HOOKS.setTokens) return log('HOOKS.setTokens is null. run SCAN, fill HOOKS, reload.');
    store.dispatch(HOOKS.setTokens(Number(cfg.tokenAmount) || DEFAULTS.tokenAmount));
  }

  // menu
  const panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;top:80px;left:20px;z-index:2147483647;width:340px;' +
    'background:#15151b;color:#e6e6ee;font:12px/1.4 Consolas,monospace;border:1px solid #333;' +
    'border-radius:6px;display:none;box-shadow:0 4px 16px rgba(0,0,0,.5)';
  panel.innerHTML = `
    <div data-h style="padding:6px 8px;background:#20202a;cursor:move;user-select:none">dolp / blooket  [INSERT]</div>
    <div style="padding:8px;display:flex;flex-wrap:wrap;gap:6px;align-items:center">
      <button data-act="scan">SCAN [F8]</button>
      <button data-act="dump">DUMP</button>
      <button data-act="max">MAX TOWERS [F6]</button>
      <button data-act="tokens">TOKENS [F7]</button>
      <label>amount <input data-cfg="tokenAmount" type="number" style="width:90px"></label>
      <label><input type="checkbox" data-cfg="auto"> auto max</label>
      <label><input type="checkbox" data-cfg="autoTokens"> auto tokens</label>
      <label>scan depth <input data-cfg="scanDepth" type="number" min="1" max="20" style="width:50px"></label>
    </div>
    <div style="padding:0 8px 8px;display:flex;gap:6px">
      <button data-act="export">EXPORT CFG</button>
      <button data-act="import">IMPORT CFG</button>
      <button data-act="reset">RESET CFG</button>
    </div>
    <textarea data-cfgbox spellcheck="false" style="display:block;box-sizing:border-box;width:calc(100% - 16px);margin:0 8px 8px;height:60px;background:#0e0e12;color:#e6e6ee;border:1px solid #333"></textarea>
    <pre data-out style="margin:0;padding:8px;height:160px;overflow:auto;border-top:1px solid #333;white-space:pre-wrap"></pre>`;
  document.body.appendChild(panel);

  const out = panel.querySelector('[data-out]');
  const cfgBox = panel.querySelector('[data-cfgbox]');
  const print = (...a) => { out.textContent += a.join(' ') + '\n'; out.scrollTop = out.scrollHeight; log(...a); };

  // config fields <-> cfg
  const syncFields = () => {
    for (const el of panel.querySelectorAll('[data-cfg]')) {
      const k = el.dataset.cfg;
      if (el.type === 'checkbox') el.checked = !!cfg[k];
      else el.value = cfg[k];
    }
  };
  for (const el of panel.querySelectorAll('[data-cfg]')) {
    el.onchange = () => {
      const k = el.dataset.cfg;
      cfg[k] = el.type === 'checkbox' ? el.checked : Number(el.value);
      saveCfg();
    };
  }
  syncFields();

  const doScan = () => {
    if (!store) return print('no store yet');
    const hits = scan(store.getState());
    print(hits.length ? hits.join('\n') : 'nothing matched. open a tower-defense round first.');
    hookDispatch();
    print('dispatch logging on. click an upgrade and watch the console.');
  };

  const doDump = () => {
    if (!store) return print('no store yet');
    const json = dumpState(store.getState());
    const put = navigator.clipboard && navigator.clipboard.writeText;
    if (put) navigator.clipboard.writeText(json).then(() => print(`state copied (${json.length} chars)`), () => print('clipboard denied. state on window.__dolpState'));
    else print('no clipboard api. state on window.__dolpState');
  };

  const actions = {
    scan: doScan,
    dump: doDump,
    max: applyMax,
    tokens: applyTokens,
    export: () => { cfgBox.value = JSON.stringify(cfg, null, 2); print('config exported to box'); },
    import: () => {
      try {
        const next = JSON.parse(cfgBox.value);
        Object.assign(cfg, DEFAULTS, next);
        saveCfg(); syncFields(); print('config imported');
      } catch (e) { print('bad json:', e.message); }
    },
    reset: () => { Object.assign(cfg, DEFAULTS); saveCfg(); syncFields(); print('config reset'); },
  };
  for (const btn of panel.querySelectorAll('[data-act]')) {
    btn.onclick = () => actions[btn.dataset.act]();
  }

  // draggable by header
  const handle = panel.querySelector('[data-h]');
  let drag = null;
  try {
    const pos = JSON.parse(localStorage.getItem(POS_KEY));
    if (pos) { panel.style.left = pos.x + 'px'; panel.style.top = pos.y + 'px'; }
  } catch (_) {}
  handle.onmousedown = e => { drag = { x: e.clientX - panel.offsetLeft, y: e.clientY - panel.offsetTop }; };
  window.addEventListener('mouseup', () => {
    if (drag) try { localStorage.setItem(POS_KEY, JSON.stringify({ x: panel.offsetLeft, y: panel.offsetTop })); } catch (_) {}
    drag = null;
  });
  window.addEventListener('mousemove', e => {
    if (!drag) return;
    panel.style.left = (e.clientX - drag.x) + 'px';
    panel.style.top = (e.clientY - drag.y) + 'px';
  });

  // hotkeys, ignored while typing in a field
  window.addEventListener('keydown', e => {
    const typing = /INPUT|TEXTAREA/.test(document.activeElement && document.activeElement.tagName);
    if (e.key === 'Insert') {
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
      return;
    }
    if (typing) return;
    if (e.key === 'F6') { e.preventDefault(); applyMax(); }
    if (e.key === 'F7') { e.preventDefault(); applyTokens(); }
    if (e.key === 'F8') { e.preventDefault(); doScan(); }
  });

  // store isn't mounted at document-idle on every page, so poll for it
  const timer = setInterval(() => {
    store = findStore();
    if (!store) return;
    clearInterval(timer);
    print('store found. INSERT toggles the menu.');
    setInterval(() => {
      if (cfg.auto && HOOKS.setTowerLevel) applyMax();
      if (cfg.autoTokens && HOOKS.setTokens) applyTokens();
    }, 1000);
  }, 500);
})();
