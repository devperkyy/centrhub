// ==UserScript==
// @name         blooket tower mod
// @namespace    centrhub
// @version      0.1.0
// @description  tower defense menu: redux scan, max towers, tokens
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

  const cfg = { tokenAmount: 999999, auto: false };
  const CFG_KEY = 'dolp-blooket-cfg';
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
      if (!o || typeof o !== 'object' || depth > 8 || seen.has(o)) return;
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

  function hookDispatch() {
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
    store.dispatch(HOOKS.setTokens(cfg.tokenAmount));
  }

  // menu
  const panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;top:80px;left:20px;z-index:2147483647;width:320px;' +
    'background:#15151b;color:#e6e6ee;font:12px/1.4 Consolas,monospace;border:1px solid #333;' +
    'border-radius:6px;display:none;box-shadow:0 4px 16px rgba(0,0,0,.5)';
  panel.innerHTML = `
    <div data-h style="padding:6px 8px;background:#20202a;cursor:move;user-select:none">dolp / blooket  [INSERT]</div>
    <div style="padding:8px;display:flex;flex-wrap:wrap;gap:6px">
      <button data-act="scan">SCAN</button>
      <button data-act="max">MAX TOWERS</button>
      <button data-act="tokens">TOKENS</button>
      <label><input type="checkbox" data-act="auto"> auto</label>
    </div>
    <pre data-out style="margin:0;padding:8px;height:160px;overflow:auto;border-top:1px solid #333;white-space:pre-wrap"></pre>`;
  document.body.appendChild(panel);

  const out = panel.querySelector('[data-out]');
  const print = (...a) => { out.textContent += a.join(' ') + '\n'; out.scrollTop = out.scrollHeight; log(...a); };
  const autoBox = panel.querySelector('[data-act="auto"]');
  autoBox.checked = cfg.auto;

  panel.querySelector('[data-act="scan"]').onclick = () => {
    if (!store) return print('no store yet');
    const hits = scan(store.getState());
    print(hits.length ? hits.join('\n') : 'nothing matched. open a tower-defense round first.');
    hookDispatch();
    print('dispatch logging on. click an upgrade and watch the console.');
  };
  panel.querySelector('[data-act="max"]').onclick = applyMax;
  panel.querySelector('[data-act="tokens"]').onclick = applyTokens;
  autoBox.onchange = () => { cfg.auto = autoBox.checked; saveCfg(); };

  // draggable by header
  const handle = panel.querySelector('[data-h]');
  let drag = null;
  handle.onmousedown = e => { drag = { x: e.clientX - panel.offsetLeft, y: e.clientY - panel.offsetTop }; };
  window.addEventListener('mouseup', () => { drag = null; });
  window.addEventListener('mousemove', e => {
    if (!drag) return;
    panel.style.left = (e.clientX - drag.x) + 'px';
    panel.style.top = (e.clientY - drag.y) + 'px';
  });

  window.addEventListener('keydown', e => {
    if (e.key === 'Insert') panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  });

  // store isn't mounted at document-idle on every page, so poll for it
  const timer = setInterval(() => {
    store = findStore();
    if (!store) return;
    clearInterval(timer);
    print('store found. INSERT toggles the menu.');
    setInterval(() => { if (cfg.auto) applyMax(); }, 1000);
  }, 500);
})();
