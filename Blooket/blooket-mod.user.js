// ==UserScript==
// @name         blooket tower mod
// @namespace    centrhub
// @version      0.3.0
// @description  tower defense menu (P): towers, economy, solo answers, misc, config
// @match        https://www.blooket.com/*
// @match        https://blooket.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

// uses the react-redux store the page already holds, found by walking the
// react fiber tree from the DOM. nothing is injected into the bundle.
// HOOKS below are the only game-specific part. they stay unfilled until a
// scan run gives the state shape and action types. the menu's hook test
// (MISC tab) shows which ones are still missing.

(() => {
  'use strict';

  const TAG = '[dolp]';
  const log = (...a) => console.log(TAG, ...a);

  // ---------- hooks (fill from scan / inspect) ----------
  const HOOKS = {
    getTowers: s => [],          // state -> [{ id, level, maxLevel }]
    getTokens: s => 0,           // state -> number
    getQuestion: s => null,      // state -> { id, answerIndex } | null
    setTowerLevel: null,         // (id, level) -> redux action
    setTokens: null,             // (n) -> redux action
  };

  // ---------- config ----------
  const DEFAULTS = {
    tokenAmount: 999999,
    tokenStep: 1000,
    autoMax: false,
    autoTokens: false,
    autoAnswer: false,
    answerDelay: 1200,
    answerJitter: 800,
    choiceSelector: '',
    scanDepth: 8,
    logDispatch: false,
  };
  const CFG_KEY = 'dolp-blooket-cfg';
  const POS_KEY = 'dolp-blooket-pos';
  const TAB_KEY = 'dolp-blooket-tab';
  const cfg = { ...DEFAULTS };
  try { Object.assign(cfg, JSON.parse(localStorage.getItem(CFG_KEY)) || {}); } catch (_) {}
  const saveCfg = () => { try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch (_) {} };

  // ---------- styles ----------
  const CSS = `
    #dolp-panel{position:fixed;top:80px;left:20px;z-index:2147483647;width:360px;
      background:#121218;color:#e6e6ee;font:12px/1.45 Consolas,"Segoe UI",monospace;
      border:1px solid #2a2a36;border-radius:10px;box-shadow:0 12px 40px rgba(0,0,0,.55);
      opacity:0;transform:translateY(-8px) scale(.98);pointer-events:none;
      transition:opacity .22s ease,transform .22s cubic-bezier(.2,.8,.2,1)}
    #dolp-panel.open{opacity:1;transform:none;pointer-events:auto}
    #dolp-head{display:flex;align-items:center;gap:8px;padding:8px 10px;background:#1b1b24;
      border-radius:10px 10px 0 0;cursor:move;user-select:none}
    #dolp-head .dot{width:8px;height:8px;border-radius:50%;background:#555;transition:background .3s,box-shadow .3s}
    #dolp-head .dot.ok{background:#3ddc84;box-shadow:0 0 8px #3ddc84}
    #dolp-head .title{flex:1;font-weight:600;letter-spacing:.3px}
    #dolp-head .key{opacity:.5;font-size:11px;border:1px solid #33334a;border-radius:4px;padding:0 5px}
    #dolp-tabs{display:flex;gap:2px;padding:6px;background:#15151d;border-bottom:1px solid #2a2a36}
    .dolp-tab{flex:1;background:none;border:0;color:#8a8aa3;padding:6px 2px;border-radius:6px;cursor:pointer;
      font:inherit;transition:background .2s,color .2s}
    .dolp-tab:hover{color:#e6e6ee;background:#1e1e28}
    .dolp-tab.on{color:#fff;background:#2a2a3c}
    .dolp-page{display:none;padding:10px;max-height:300px;overflow:auto}
    .dolp-page.on{display:block;animation:dolpIn .25s ease}
    @keyframes dolpIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
    .dolp-card{background:#1a1a24;border:1px solid #262634;border-radius:8px;padding:8px;margin-bottom:8px}
    .dolp-card h4{margin:0 0 6px;font-size:10px;letter-spacing:.9px;text-transform:uppercase;color:#8a8aa3;font-weight:600}
    .dolp-row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:4px 0}
    .dolp-btns{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}
    .dolp-btn{background:#23233a;color:#e6e6ee;border:1px solid #33334a;border-radius:6px;padding:5px 9px;
      cursor:pointer;font:inherit;transition:transform .12s,background .2s,border-color .2s}
    .dolp-btn:hover{background:#2c2c48;border-color:#4a4a6a}
    .dolp-btn:active{transform:scale(.95)}
    .dolp-in{background:#0e0e14;color:#e6e6ee;border:1px solid #33334a;border-radius:6px;padding:3px 6px;
      width:86px;font:inherit;transition:border-color .2s}
    .dolp-in.wide{width:170px}
    .dolp-in:focus{outline:none;border-color:#7c6cff}
    .dolp-sw{position:relative;width:34px;height:18px;flex:none}
    .dolp-sw input{opacity:0;width:0;height:0;position:absolute}
    .dolp-sw span{position:absolute;inset:0;background:#33334a;border-radius:18px;transition:background .25s}
    .dolp-sw span::after{content:"";position:absolute;left:2px;top:2px;width:14px;height:14px;
      background:#e6e6ee;border-radius:50%;transition:transform .25s cubic-bezier(.2,.8,.2,1)}
    .dolp-sw input:checked + span{background:#7c6cff}
    .dolp-sw input:checked + span::after{transform:translateX(16px)}
    .dolp-sw input:focus-visible + span{box-shadow:0 0 0 2px #7c6cff}
    #dolp-status{padding:6px 10px;border-top:1px solid #2a2a36;color:#9a9ab0;font-size:11px}
    #dolp-log{margin:0;padding:8px;height:120px;overflow:auto;background:#0e0e14;border-top:1px solid #2a2a36;
      white-space:pre-wrap;font-size:11px;border-radius:0 0 10px 10px}
    #dolp-toasts{position:fixed;right:16px;bottom:16px;z-index:2147483647;display:flex;flex-direction:column;
      align-items:flex-end;gap:6px;pointer-events:none}
    .dolp-toast{background:#1b1b24;border:1px solid #2a2a36;border-left:3px solid #7c6cff;color:#e6e6ee;
      padding:7px 12px;border-radius:6px;font:12px Consolas,monospace;opacity:0;transform:translateX(24px);
      transition:opacity .25s,transform .25s cubic-bezier(.2,.8,.2,1)}
    .dolp-toast.show{opacity:1;transform:none}
    .dolp-toast.ok{border-left-color:#3ddc84}
    .dolp-toast.bad{border-left-color:#ff5c7a}
    .dolp-toast.dim{border-left-color:#555}
    @media (prefers-reduced-motion:reduce){#dolp-panel,#dolp-panel *,#dolp-toasts *{transition:none!important;animation:none!important}}
  `;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  // ---------- menu markup ----------
  const sw = (k, label) => `<label class="dolp-row"><span>${label}</span>
    <span class="dolp-sw"><input type="checkbox" data-cfg="${k}"><span></span></span></label>`;
  const num = (k, label, cls = '') => `<label class="dolp-row"><span>${label}</span>
    <input class="dolp-in ${cls}" type="number" data-cfg="${k}"></label>`;
  const txt = (k, label) => `<label class="dolp-row"><span>${label}</span>
    <input class="dolp-in wide" type="text" data-cfg="${k}" spellcheck="false"></label>`;
  const btn = (act, label) => `<button class="dolp-btn" data-act="${act}">${label}</button>`;

  const panel = document.createElement('div');
  panel.id = 'dolp-panel';
  panel.innerHTML = `
    <div id="dolp-head"><span class="dot"></span><span class="title">dolp / blooket</span><span class="key">P</span></div>
    <div id="dolp-tabs">
      <button class="dolp-tab" data-tab="towers">towers</button>
      <button class="dolp-tab" data-tab="economy">economy</button>
      <button class="dolp-tab" data-tab="solo">solo</button>
      <button class="dolp-tab" data-tab="misc">misc</button>
      <button class="dolp-tab" data-tab="config">config</button>
    </div>

    <div class="dolp-page" data-page="towers">
      <div class="dolp-card"><h4>upgrades</h4>
        <div class="dolp-btns">${btn('maxTowers', 'max now [F6]')}</div>
        ${sw('autoMax', 'auto max every second')}
      </div>
    </div>

    <div class="dolp-page" data-page="economy">
      <div class="dolp-card"><h4>tokens</h4>
        ${num('tokenAmount', 'set to')}
        ${num('tokenStep', 'step')}
        <div class="dolp-btns">${btn('setTokens', 'set [F7]')} ${btn('addTokens', '+ step')}</div>
        ${sw('autoTokens', 'auto set every second')}
      </div>
    </div>

    <div class="dolp-page" data-page="solo">
      <div class="dolp-card"><h4>auto answer (solo only)</h4>
        ${sw('autoAnswer', 'enabled [F9]')}
        ${num('answerDelay', 'delay ms')}
        ${num('answerJitter', 'jitter ms')}
        ${txt('choiceSelector', 'choice selector')}
        <div class="dolp-btns">${btn('answerNow', 'answer current')}</div>
      </div>
    </div>

    <div class="dolp-page" data-page="misc">
      <div class="dolp-card"><h4>state</h4>
        <div class="dolp-btns">${btn('scan', 'scan [F8]')} ${btn('dump', 'dump to clipboard')} ${btn('hookTest', 'hook test')}</div>
        ${sw('logDispatch', 'log dispatched actions')}
        ${num('scanDepth', 'scan depth')}
      </div>
    </div>

    <div class="dolp-page" data-page="config">
      <div class="dolp-card"><h4>config</h4>
        <textarea data-cfgbox spellcheck="false" style="box-sizing:border-box;width:100%;height:90px;
          background:#0e0e14;color:#e6e6ee;border:1px solid #33334a;border-radius:6px;font:inherit;padding:6px"></textarea>
        <div class="dolp-btns">${btn('export', 'export')} ${btn('import', 'import')} ${btn('reset', 'reset')}</div>
      </div>
    </div>

    <div id="dolp-status">status: waiting for store</div>
    <pre id="dolp-log"></pre>`;
  document.body.appendChild(panel);

  const toasts = document.createElement('div');
  toasts.id = 'dolp-toasts';
  document.body.appendChild(toasts);

  const logBox = panel.querySelector('#dolp-log');
  const statusEl = panel.querySelector('#dolp-status');
  const cfgBox = panel.querySelector('[data-cfgbox]');
  const dot = panel.querySelector('.dot');

  const print = (...a) => {
    logBox.textContent += a.join(' ') + '\n';
    logBox.scrollTop = logBox.scrollHeight;
    log(...a);
  };

  const toast = (msg, kind = '') => {
    const t = document.createElement('div');
    t.className = 'dolp-toast ' + kind;
    t.textContent = msg;
    toasts.appendChild(t);
    requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('show')));
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 280);
    }, 2200);
  };

  // ---------- tabs ----------
  const showTab = name => {
    for (const t of panel.querySelectorAll('.dolp-tab')) t.classList.toggle('on', t.dataset.tab === name);
    for (const p of panel.querySelectorAll('.dolp-page')) p.classList.toggle('on', p.dataset.page === name);
    try { localStorage.setItem(TAB_KEY, name); } catch (_) {}
  };
  for (const t of panel.querySelectorAll('.dolp-tab')) t.onclick = () => showTab(t.dataset.tab);
  try { showTab(localStorage.getItem(TAB_KEY) || 'towers'); } catch (_) { showTab('towers'); }

  // ---------- config <-> fields ----------
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
      cfg[k] = el.type === 'checkbox' ? el.checked : el.type === 'text' ? el.value : Number(el.value);
      saveCfg();
    };
  }
  syncFields();

  // ---------- store ----------
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

  function wrapDispatch() {
    if (store.__dolpWrapped) return;
    store.__dolpWrapped = true;
    const real = store.dispatch;
    store.dispatch = a => {
      if (cfg.logDispatch) log('dispatch', a && a.type, a);
      return real(a);
    };
  }

  const state = () => store.getState();

  // ---------- features (quiet = called from the tick loop, no toasts) ----------
  function maxTowers(quiet = false) {
    if (!store) return quiet || toast('no store yet', 'bad');
    if (!HOOKS.setTowerLevel) return quiet || toast('towers hook not filled', 'bad');
    let n = 0;
    for (const t of HOOKS.getTowers(state())) {
      if (t.level < t.maxLevel) { store.dispatch(HOOKS.setTowerLevel(t.id, t.maxLevel)); n++; }
    }
    if (!quiet) toast(n ? `maxed ${n} tower${n > 1 ? 's' : ''}` : 'nothing to max', n ? 'ok' : 'dim');
    return n;
  }

  function setTokens(amount, quiet = false) {
    if (!store) return quiet || toast('no store yet', 'bad');
    if (!HOOKS.setTokens) return quiet || toast('tokens hook not filled', 'bad');
    store.dispatch(HOOKS.setTokens(Number(amount) || 0));
    if (!quiet) toast(`tokens set to ${amount}`, 'ok');
  }

  function addTokens() {
    if (!store) return toast('no store yet', 'bad');
    if (!HOOKS.getTokens || !HOOKS.setTokens) return toast('tokens hooks not filled', 'bad');
    const now = HOOKS.getTokens(state());
    store.dispatch(HOOKS.setTokens(now + Number(cfg.tokenStep)));
    toast(`+${cfg.tokenStep} tokens`, 'ok');
  }

  // answers the active solo question by clicking the choice at answerIndex
  let lastQuestion = null;
  let lastAnswer = '';
  function autoAnswer(quiet = false, force = false) {
    if (!store || !HOOKS.getQuestion) return;
    const q = HOOKS.getQuestion(state());
    if (!q || q.answerIndex == null) return;
    const key = q.id ?? q.answerIndex;
    if (!force && key === lastQuestion) return;
    lastQuestion = key;
    if (!cfg.choiceSelector) return quiet || toast('set a choice selector first', 'bad');
    const el = document.querySelectorAll(cfg.choiceSelector)[q.answerIndex];
    if (!el) return quiet || toast(`no choice at index ${q.answerIndex}`, 'bad');
    const wait = Number(cfg.answerDelay) + Math.random() * Number(cfg.answerJitter);
    lastAnswer = `answered #${q.answerIndex} in ${Math.round(wait)}ms`;
    setTimeout(() => el.click(), wait);
  }

  // walks the state for anything that looks like towers, levels or tokens
  function scan(s) {
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
    walk(s, '', 0);
    return hits;
  }

  // full state as json, cycle-safe. also on window.__dolpState
  function dumpState(s) {
    const seen = new WeakSet();
    const json = JSON.stringify(s, (k, v) => {
      if (v && typeof v === 'object') {
        if (seen.has(v)) return '[cycle]';
        seen.add(v);
      }
      return typeof v === 'function' ? '[fn]' : v;
    }, 2);
    window.__dolpState = s;
    return json;
  }

  function hookTest() {
    if (!store) return print('no store yet');
    const unfilled = Object.entries(HOOKS).filter(([, v]) => v === null).map(([k]) => k);
    print(unfilled.length ? `unfilled setters: ${unfilled.join(', ')}` : 'all setters filled');
    for (const name of ['getTokens', 'getTowers', 'getQuestion']) {
      try { print(`${name}: ${JSON.stringify(HOOKS[name](state()))}`); }
      catch (e) { print(`${name} threw: ${e.message}`); }
    }
  }

  const doScan = () => {
    if (!store) return print('no store yet');
    const hits = scan(state());
    print(hits.length ? hits.join('\n') : 'nothing matched. open a tower-defense round first.');
    print(cfg.logDispatch ? 'dispatch logging is on' : 'turn on "log dispatched actions" to see actions');
  };

  const doDump = () => {
    if (!store) return print('no store yet');
    const json = dumpState(state());
    const clip = navigator.clipboard && navigator.clipboard.writeText;
    if (!clip) return print('no clipboard api. state on window.__dolpState');
    navigator.clipboard.writeText(json).then(
      () => { print(`state copied (${json.length} chars)`); toast('state copied', 'ok'); },
      () => print('clipboard denied. state on window.__dolpState'));
  };

  // ---------- actions (buttons) ----------
  const actions = {
    maxTowers: () => maxTowers(false),
    setTokens: () => setTokens(cfg.tokenAmount),
    addTokens,
    answerNow: () => autoAnswer(false, true),
    scan: doScan,
    dump: doDump,
    hookTest,
    export: () => { cfgBox.value = JSON.stringify(cfg, null, 2); print('config exported to box'); },
    import: () => {
      try {
        Object.assign(cfg, DEFAULTS, JSON.parse(cfgBox.value));
        saveCfg(); syncFields(); toast('config imported', 'ok');
      } catch (e) { toast('bad json', 'bad'); print('bad json:', e.message); }
    },
    reset: () => { Object.assign(cfg, DEFAULTS); saveCfg(); syncFields(); toast('config reset', 'dim'); },
  };
  for (const b of panel.querySelectorAll('[data-act]')) b.onclick = () => actions[b.dataset.act]();

  // ---------- open / close ----------
  const togglePanel = () => panel.classList.toggle('open');

  // ---------- drag, clamped to viewport, position remembered ----------
  const head = panel.querySelector('#dolp-head');
  let drag = null;
  try {
    const pos = JSON.parse(localStorage.getItem(POS_KEY));
    if (pos) { panel.style.left = pos.x + 'px'; panel.style.top = pos.y + 'px'; }
  } catch (_) {}
  head.onmousedown = e => { drag = { x: e.clientX - panel.offsetLeft, y: e.clientY - panel.offsetTop }; };
  window.addEventListener('mousemove', e => {
    if (!drag) return;
    const x = Math.min(Math.max(0, e.clientX - drag.x), innerWidth - 60);
    const y = Math.min(Math.max(0, e.clientY - drag.y), innerHeight - 40);
    panel.style.left = x + 'px';
    panel.style.top = y + 'px';
  });
  window.addEventListener('mouseup', () => {
    if (drag) try { localStorage.setItem(POS_KEY, JSON.stringify({ x: panel.offsetLeft, y: panel.offsetTop })); } catch (_) {}
    drag = null;
  });

  // ---------- hotkeys (ignored while typing) ----------
  window.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = document.activeElement;
    if (t && (/INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.isContentEditable)) return;
    if (e.key === 'p' || e.key === 'P') return togglePanel();
    if (e.key === 'F6') { e.preventDefault(); maxTowers(false); }
    if (e.key === 'F7') { e.preventDefault(); setTokens(cfg.tokenAmount); }
    if (e.key === 'F8') { e.preventDefault(); doScan(); }
    if (e.key === 'F9') {
      e.preventDefault();
      cfg.autoAnswer = !cfg.autoAnswer;
      saveCfg(); syncFields();
      toast(`auto answer ${cfg.autoAnswer ? 'on' : 'off'}`, cfg.autoAnswer ? 'ok' : 'dim');
    }
  });

  // ---------- live status + tick loop ----------
  const refreshStatus = () => {
    if (!store) return;
    const parts = [];
    try {
      if (HOOKS.getTokens) parts.push(`tokens ${HOOKS.getTokens(state())}`);
      if (HOOKS.getTowers) {
        const towers = HOOKS.getTowers(state());
        const maxed = towers.filter(t => t.level >= t.maxLevel).length;
        parts.push(`towers ${towers.length} (${maxed} maxed)`);
      }
      if (lastAnswer) parts.push(lastAnswer);
    } catch (e) { parts.push(`hook error: ${e.message}`); }
    statusEl.textContent = parts.length ? 'status: ' + parts.join(' | ') : 'status: hooks not filled';
  };

  // store isn't mounted at document-idle on every page, so poll for it
  const find = setInterval(() => {
    store = findStore();
    if (!store) return;
    clearInterval(find);
    wrapDispatch();
    dot.classList.add('ok');
    print('store found. press P for the menu.');
    toast('dolp loaded. press P', 'ok');
    setInterval(() => {
      if (cfg.autoMax && HOOKS.setTowerLevel) maxTowers(true);
      if (cfg.autoTokens && HOOKS.setTokens) setTokens(cfg.tokenAmount, true);
      if (cfg.autoAnswer) autoAnswer(true);
      refreshStatus();
    }, 1000);
  }, 500);
})();
