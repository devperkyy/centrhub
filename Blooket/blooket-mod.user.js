// ==UserScript==
// @name         blooket tower mod
// @namespace    centrhub
// @version      0.4.0
// @description  tower defense menu (P): towers, economy, game, buffs, enemies, stats, solo, misc, config
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
    healthAmount: 100,
    autoHealth: false,
    roundTarget: 1,
    buffField: '',
    buffMult: 2,
    buffScope: 'all',
    buffAuto: false,
    watchState: false,
    dragPlace: false,
    syncUpgrades: false,
    invincible: false,
    damageMult: 2,
    damageBoost: false,
    force2x: false,
    autoNext: false,
    autoMax: false,
    autoTokens: false,
    autoAnswer: false,
    answerDelay: 1200,
    answerJitter: 800,
    choiceSelector: '',
    scanDepth: 8,
    logDispatch: false,
    autoRevive: false,
    autoSkip: false,
    slowEnemies: false,
    slowMult: 0.5,
    turbo: false,
    fps: 120,
    profile: '',
  };
  const CFG_KEY = 'dolp-blooket-cfg';
  const POS_KEY = 'dolp-blooket-pos';
  const TAB_KEY = 'dolp-blooket-tab';
  const cfg = { ...DEFAULTS };
  try { Object.assign(cfg, JSON.parse(localStorage.getItem(CFG_KEY)) || {}); } catch (_) {}
  const saveCfg = () => { try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch (_) {} };

  // ---------- styles ----------
  const CSS = `
    #dolp-panel{position:fixed;top:70px;left:20px;z-index:2147483647;width:580px;max-width:calc(100vw - 24px);
      display:grid;grid-template-columns:124px minmax(0,1fr);grid-template-rows:auto auto minmax(0,1fr) auto auto;
      color:#eceaff;font:12px/1.45 "Segoe UI",system-ui,sans-serif;overflow:hidden;
      border:1px solid transparent;border-radius:16px;
      background:linear-gradient(160deg,#1b1744,#0b1228) padding-box,
                 linear-gradient(135deg,#7c5cff,#2fd4ff 55%,#ff5ca8) border-box;
      box-shadow:0 24px 60px rgba(0,0,0,.6),0 0 44px rgba(124,92,255,.2);
      opacity:0;transform:translateY(-10px) scale(.97);pointer-events:none;
      transition:opacity .25s ease,transform .3s cubic-bezier(.2,.9,.2,1)}
    #dolp-panel.open{opacity:1;transform:none;pointer-events:auto}
    #dolp-panel *{box-sizing:border-box}

    #dolp-head{grid-column:1/-1;grid-row:1;display:flex;align-items:center;gap:10px;padding:10px 14px;
      cursor:move;user-select:none;
      background:linear-gradient(90deg,rgba(124,92,255,.38),rgba(47,212,255,.16) 62%,transparent)}
    #dolp-head .dot{width:9px;height:9px;border-radius:50%;background:#4b4f78;transition:background .3s,box-shadow .3s}
    #dolp-head .dot.ok{background:#3ddc84;box-shadow:0 0 10px #3ddc84}
    #dolp-head .title{flex:1;font-weight:700;font-size:13px;letter-spacing:.5px;
      background:linear-gradient(90deg,#fff,#b9b4ff 70%);-webkit-background-clip:text;background-clip:text;color:transparent}
    #dolp-head .key{font-size:11px;font-weight:700;color:#b9b4ff;border:1px solid rgba(185,180,255,.35);
      border-radius:6px;padding:0 7px}

    #dolp-chips{grid-column:1/-1;grid-row:2;display:flex;gap:8px;padding:2px 14px 12px}
    .dolp-chip{flex:1;min-width:0;padding:7px 10px;border-radius:11px;
      background:linear-gradient(135deg,rgba(255,255,255,.07),rgba(255,255,255,.02));
      border:1px solid rgba(255,255,255,.07)}
    .dolp-chip small{display:block;font-size:9px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#8d90b8}
    .dolp-chip b{display:block;font-size:15px;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap;
      overflow:hidden;text-overflow:ellipsis;
      background:linear-gradient(90deg,var(--c1),var(--c2));-webkit-background-clip:text;background-clip:text;color:transparent}

    #dolp-tabs{grid-column:1;grid-row:3;display:flex;flex-direction:column;gap:3px;padding:8px;
      background:rgba(0,0,0,.2);border-right:1px solid rgba(255,255,255,.06)}
    .dolp-tab{position:relative;text-align:left;background:none;border:0;color:#8d90b8;font:inherit;font-weight:600;
      padding:8px 10px 8px 15px;border-radius:9px;cursor:pointer;transition:color .2s,background .25s}
    .dolp-tab::before{content:"";position:absolute;left:5px;top:9px;bottom:9px;width:3px;border-radius:3px;
      background:linear-gradient(#7c5cff,#2fd4ff);opacity:0;transform:scaleY(.3);transition:opacity .25s,transform .25s}
    .dolp-tab:hover{color:#fff;background:rgba(255,255,255,.05)}
    .dolp-tab.on{color:#fff;background:linear-gradient(90deg,rgba(124,92,255,.34),rgba(47,212,255,.07))}
    .dolp-tab.on::before{opacity:1;transform:none}

    .dolp-page{grid-column:2;grid-row:3;display:none;padding:12px;max-height:clamp(170px,calc(100vh - 340px),380px);overflow:auto}
    .dolp-page.on{display:block;animation:dolpIn .3s cubic-bezier(.2,.9,.2,1)}
    @keyframes dolpIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
    .dolp-page::-webkit-scrollbar,#dolp-log::-webkit-scrollbar{width:8px}
    .dolp-page::-webkit-scrollbar-thumb,#dolp-log::-webkit-scrollbar-thumb{background:rgba(255,255,255,.14);border-radius:8px}

    .dolp-card{background:linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.02));
      border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:10px 12px;margin-bottom:10px}
    .dolp-card h4{margin:0 0 8px;font-size:10px;font-weight:700;letter-spacing:1.3px;text-transform:uppercase;
      background:linear-gradient(90deg,#a99bff,#6fe3ff);-webkit-background-clip:text;background-clip:text;color:transparent}
    .dolp-card p{margin:0 0 8px;color:#8d90b8;font-size:11px}
    .dolp-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:5px 0}
    .dolp-row > span:first-child{color:#d6d4f5}
    .dolp-btns{display:flex;flex-wrap:wrap;gap:7px;margin:4px 0}

    .dolp-btn{border:0;color:#fff;font:inherit;font-weight:600;padding:6px 12px;border-radius:9px;cursor:pointer;
      background:linear-gradient(135deg,#6a55ff,#2aa8ff);box-shadow:0 4px 14px rgba(70,90,255,.28);
      transition:transform .15s,box-shadow .2s,filter .2s}
    .dolp-btn:hover{filter:brightness(1.14);box-shadow:0 6px 20px rgba(70,120,255,.42);transform:translateY(-1px)}
    .dolp-btn:active{transform:scale(.96)}
    .dolp-btn.ghost{background:rgba(255,255,255,.08);box-shadow:none}
    .dolp-btn.danger{background:linear-gradient(135deg,#ff5c7a,#ff8a4a);box-shadow:0 4px 14px rgba(255,92,122,.28)}
    .dolp-btn.small{padding:3px 10px;font-size:11px}

    .dolp-in{background:rgba(5,8,22,.7);color:#eceaff;border:1px solid rgba(255,255,255,.1);border-radius:8px;
      padding:5px 8px;width:96px;font:inherit;transition:border-color .2s,box-shadow .2s}
    .dolp-in.wide{width:190px}
    .dolp-in:focus{outline:none;border-color:#7c5cff;box-shadow:0 0 0 3px rgba(124,92,255,.25)}
    select.dolp-in option{background:#12163a;color:#eceaff}

    .dolp-sw{position:relative;width:38px;height:20px;flex:none}
    .dolp-sw input{opacity:0;width:0;height:0;position:absolute}
    .dolp-sw span{position:absolute;inset:0;background:rgba(255,255,255,.14);border-radius:20px;transition:background .25s,box-shadow .25s}
    .dolp-sw span::after{content:"";position:absolute;left:3px;top:3px;width:14px;height:14px;background:#fff;border-radius:50%;
      box-shadow:0 1px 4px rgba(0,0,0,.4);transition:transform .28s cubic-bezier(.2,.9,.2,1)}
    .dolp-sw input:checked + span{background:linear-gradient(135deg,#7c5cff,#2fd4ff);box-shadow:0 0 14px rgba(90,140,255,.45)}
    .dolp-sw input:checked + span::after{transform:translateX(18px)}
    .dolp-sw input:focus-visible + span{box-shadow:0 0 0 3px rgba(124,92,255,.4)}

    #dolp-status{grid-column:1/-1;grid-row:4;padding:7px 14px;border-top:1px solid rgba(255,255,255,.07);
      color:#8d90b8;font-size:11px;font-variant-numeric:tabular-nums}
    #dolp-log{grid-column:1/-1;grid-row:5;margin:0;padding:8px 14px;height:72px;overflow:auto;
      background:rgba(3,6,18,.7);white-space:pre-wrap;font:11px/1.45 Consolas,monospace;color:#b9c0e8}

    #dolp-toasts{position:fixed;right:16px;bottom:16px;z-index:2147483647;display:flex;flex-direction:column;
      align-items:flex-end;gap:7px;pointer-events:none}
    .dolp-toast{background:linear-gradient(135deg,#1b1744,#101a38);border:1px solid rgba(255,255,255,.1);
      border-left:3px solid #7c5cff;color:#eceaff;padding:8px 14px;border-radius:10px;font:12px "Segoe UI",system-ui,sans-serif;
      box-shadow:0 8px 24px rgba(0,0,0,.45);opacity:0;transform:translateX(26px);
      transition:opacity .25s,transform .3s cubic-bezier(.2,.9,.2,1)}
    .dolp-toast.show{opacity:1;transform:none}
    .dolp-toast.ok{border-left-color:#3ddc84}
    .dolp-toast.bad{border-left-color:#ff5c7a}
    .dolp-toast.dim{border-left-color:#6b6f99}

    @media (max-width:640px){#dolp-panel{grid-template-columns:96px minmax(0,1fr)}.dolp-chip b{font-size:13px}}
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
  const btn = (act, label, cls = '') => `<button class="dolp-btn ${cls}" data-act="${act}">${label}</button>`;
  const chip = (k, label, c1, c2) => `<div class="dolp-chip" style="--c1:${c1};--c2:${c2}">
    <small>${label}</small><b data-chip="${k}">-</b></div>`;
  const stat = (k, label) => `<div class="dolp-row"><span>${label}</span><span data-stat="${k}">-</span></div>`;

  const panel = document.createElement('div');
  panel.id = 'dolp-panel';
  panel.innerHTML = `
    <div id="dolp-head">
      <span class="dot"></span><span class="title">dolp / blooket</span>
      ${btn('killAll', 'stop all [K]', 'danger small')}
      <span class="key">P</span>
    </div>
    <div id="dolp-chips">
      ${chip('tokens', 'tokens', '#ffd36b', '#ff9f45')}
      ${chip('health', 'health', '#ff8aa8', '#ff5c7a')}
      ${chip('round', 'round', '#9ab4ff', '#7c5cff')}
      ${chip('towers', 'towers', '#7df0c8', '#2fd4ff')}
      ${chip('dps', 'dps', '#ffb4f0', '#ff5ca8')}
    </div>
    <div id="dolp-tabs">
      <button class="dolp-tab" data-tab="towers">towers</button>
      <button class="dolp-tab" data-tab="economy">economy</button>
      <button class="dolp-tab" data-tab="game">game</button>
      <button class="dolp-tab" data-tab="buffs">buffs</button>
      <button class="dolp-tab" data-tab="enemies">enemies</button>
      <button class="dolp-tab" data-tab="stats">stats</button>
      <button class="dolp-tab" data-tab="solo">solo</button>
      <button class="dolp-tab" data-tab="misc">misc</button>
      <button class="dolp-tab" data-tab="config">config</button>
    </div>

    <div class="dolp-page" data-page="towers">
      <div class="dolp-card"><h4>upgrades</h4>
        <p>upgrade one tower by hand first. each step is recorded, then replayed on the others.</p>
        <div class="dolp-btns">${btn('maxTowers', 'max all [F6]')} ${btn('maxType', 'max same type')} ${btn('maxSel', 'max selected')}</div>
        ${sw('autoMax', 'auto max every tick')}
        ${sw('syncUpgrades', 'upgrade all matching towers')}
        <div class="dolp-row"><span>upgrade steps recorded</span><span data-steps>0</span></div>
      </div>
      <div class="dolp-card"><h4>build</h4>
        ${sw('dragPlace', 'drag to place towers')}
        <div class="dolp-row"><span>tower</span><span data-chosen>none chosen</span></div>
      </div>
      <div class="dolp-card"><h4>delete</h4>
        <div class="dolp-btns">${btn('deleteSelected', 'selected', 'danger')} ${btn('deleteMatching', 'same type', 'danger')} ${btn('deleteAll', 'all towers', 'danger')}</div>
      </div>
      <div class="dolp-card"><h4>inspect</h4>
        <div class="dolp-btns">${btn('inspectTowers', 'inspect towers', 'ghost')}</div>
      </div>
    </div>

    <div class="dolp-page" data-page="economy">
      <div class="dolp-card"><h4>tokens</h4>
        ${num('tokenAmount', 'set to')}
        ${num('tokenStep', 'step')}
        <div class="dolp-btns">${btn('setTokens', 'set [F7]')} ${btn('addTokens', '+ step')}</div>
        ${sw('autoTokens', 'keep set every tick')}
      </div>
    </div>

    <div class="dolp-page" data-page="game">
      <div class="dolp-card"><h4>rounds</h4>
        ${num('roundTarget', 'round')}
        <div class="dolp-btns">${btn('setRound', 'set round')} ${btn('skipRound', 'skip round')}</div>
        ${sw('autoNext', 'auto next round')}
      </div>
      <div class="dolp-card"><h4>survival</h4>
        ${num('healthAmount', 'health')}
        <div class="dolp-btns">${btn('setHealth', 'set health')} ${btn('revive', 'revive')}</div>
        ${sw('autoHealth', 'keep health topped up')}
        ${sw('invincible', 'invincible (health never drops)')}
        ${sw('autoRevive', 'auto revive on game over')}
      </div>
      <div class="dolp-card"><h4>speed</h4>
        <div class="dolp-btns">${btn('togglePause', 'pause / resume')} ${btn('toggleSpeed', 'toggle 2x')}</div>
        ${sw('force2x', 'keep 2x speed on')}
        ${num('fps', 'turbo frame rate')}
        <div class="dolp-btns">${btn('applyFps', 'apply fps')} ${btn('resetFps', 'back to 60', 'ghost')}</div>
        ${sw('turbo', 'hold turbo frame rate')}
      </div>
      <div class="dolp-card"><h4>snapshot (numbers only)</h4>
        <p>saves tokens, health and round. restoring does not bring back towers.</p>
        <div class="dolp-btns">${btn('saveSnap', 'save')} ${btn('restoreSnap', 'restore')}</div>
      </div>
    </div>

    <div class="dolp-page" data-page="buffs">
      <div class="dolp-card"><h4>who gets it</h4>
        <label class="dolp-row"><span>apply to</span>
          <select class="dolp-in wide" data-cfg="buffScope">
            <option value="selected">selected tower</option>
            <option value="type">same type as selected</option>
            <option value="all">all towers</option>
          </select></label>
      </div>
      <div class="dolp-card"><h4>stat buff</h4>
        <div class="dolp-btns">${btn('buffRange', 'range')} ${btn('buffSpeed', 'speed')} ${btn('buffDamage', 'damage')} ${btn('listFields', 'list fields', 'ghost')}</div>
        ${txt('buffField', 'field')}
        ${num('buffMult', 'multiplier (x)')}
        <div class="dolp-btns">${btn('applyBuff', 'apply')} ${btn('resetBuffs', 'reset', 'ghost')}</div>
        ${sw('buffAuto', 're-apply every tick')}
      </div>
      <div class="dolp-card"><h4>damage dealt</h4>
        <p>needs enemies on screen so the enemy list can be found.</p>
        ${num('damageMult', 'multiplier (x)')}
        ${sw('damageBoost', 'multiply damage dealt')}
      </div>
    </div>

    <div class="dolp-page" data-page="enemies">
      <div class="dolp-card"><h4>enemies</h4>
        <p>the enemy list is found by shape, so enemies must be on screen.</p>
        <div class="dolp-btns">${btn('nuke', 'nuke all enemies', 'danger')}</div>
        ${num('slowMult', 'speed multiplier (x)')}
        ${sw('slowEnemies', 'scale enemy speed')}
        <div class="dolp-row"><span>enemies on screen</span><span data-stat="enemies">-</span></div>
      </div>
    </div>

    <div class="dolp-page" data-page="stats">
      <div class="dolp-card"><h4>damage</h4>
        ${stat('dps', 'dps (5s average)')}
        ${stat('peak', 'peak dps')}
        ${stat('total', 'total damage this session')}
      </div>
      <div class="dolp-card"><h4>session</h4>
        ${stat('time', 'time')}
        ${stat('steps', 'upgrade steps recorded')}
        <div class="dolp-btns">${btn('resetStats', 'reset stats', 'ghost')}</div>
      </div>
    </div>

    <div class="dolp-page" data-page="solo">
      <div class="dolp-card"><h4>questions (solo only)</h4>
        <div class="dolp-btns">${btn('skipQuestion', 'skip question')}</div>
        ${sw('autoSkip', 'auto skip questions')}
      </div>
      <div class="dolp-card"><h4>auto answer</h4>
        ${sw('autoAnswer', 'enabled [F9]')}
        ${num('answerDelay', 'delay ms')}
        ${num('answerJitter', 'jitter ms')}
        ${txt('choiceSelector', 'choice selector')}
        <div class="dolp-btns">${btn('answerNow', 'answer current')}</div>
      </div>
    </div>

    <div class="dolp-page" data-page="misc">
      <div class="dolp-card"><h4>scan</h4>
        <div class="dolp-btns">${btn('scan', 'scan [F8]', 'ghost')} ${btn('dump', 'dump to clipboard', 'ghost')} ${btn('hookTest', 'hook test', 'ghost')} ${btn('scanFibers', 'scan components', 'ghost')}</div>
        ${num('scanDepth', 'scan depth')}
      </div>
      <div class="dolp-card"><h4>trace</h4>
        <div class="dolp-btns">${btn('traceBuy', 'trace buy / upgrade', 'ghost')}</div>
        ${sw('logDispatch', 'log dispatched actions')}
        ${sw('watchState', 'log game state changes')}
      </div>
    </div>

    <div class="dolp-page" data-page="config">
      <div class="dolp-card"><h4>profiles</h4>
        ${txt('profile', 'name')}
        <div class="dolp-btns">${btn('saveProfile', 'save')} ${btn('loadProfile', 'load')} ${btn('deleteProfile', 'delete', 'danger')} ${btn('listProfiles', 'list', 'ghost')}</div>
      </div>
      <div class="dolp-card"><h4>config json</h4>
        <textarea data-cfgbox spellcheck="false" class="dolp-in" style="width:100%;height:90px;resize:vertical"></textarea>
        <div class="dolp-btns">${btn('export', 'export')} ${btn('import', 'import')} ${btn('reset', 'reset', 'danger')}</div>
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
  const chosenEl = panel.querySelector('[data-chosen]');
  const stepsEl = panel.querySelector('[data-steps]');
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
      cfg[k] = el.type === 'checkbox' ? el.checked
        : (el.type === 'text' || el.tagName === 'SELECT') ? el.value : Number(el.value);
      saveCfg();
    };
  }
  syncFields();

  // ---------- store ----------
  let store = null;

  // redux-like store: has getState and dispatch
  const isStore = o => !!o && typeof o.getState === 'function' && typeof o.dispatch === 'function';

  // checks a fiber's props and hook state, one level deep, for a store
  function storeOnFiber(f) {
    const p = f.memoizedProps;
    if (p && typeof p === 'object') {
      for (const v of Object.values(p)) {
        if (isStore(v)) return v;
        if (v && typeof v === 'object' && isStore(v.store)) return v.store;
        if (v && typeof v === 'object' && isStore(v.value)) return v.value;
      }
    }
    for (let h = f.memoizedState; h; h = h.next) {
      const m = h.memoizedState;
      if (isStore(m)) return m;
      if (m && typeof m === 'object' && isStore(m.store)) return m.store;
    }
    return null;
  }

  function findStore() {
    for (const el of document.querySelectorAll('body *')) {
      const k = Object.keys(el).find(x => x.startsWith('__reactFiber$'));
      if (!k) continue;
      for (let f = el[k]; f; f = f.return) {
        const s = storeOnFiber(f);
        if (s) return s;
      }
    }
    return null;
  }

  // one-time report when no store is found, pasted into the log box
  function diagnose() {
    const el = [...document.querySelectorAll('body *')].find(e => Object.keys(e).some(x => x.startsWith('__reactFiber$')));
    if (!el) return print('diag: no react fiber on any element. page may not be react, or not rendered yet');
    const k = Object.keys(el).find(x => x.startsWith('__reactFiber$'));
    const names = [];
    for (let f = el[k]; f && names.length < 25; f = f.return) {
      const t = f.type;
      names.push(typeof t === 'string' ? t : (t && (t.displayName || t.name)) || '?');
    }
    print('diag: fiber chain ' + names.join(' > '));
    const globals = ['__REDUX_DEVTOOLS_EXTENSION__', '__NEXT_DATA__', '__APOLLO_STATE__'].filter(g => window[g]);
    print('diag: globals ' + (globals.join(', ') || 'none'));
    print('diag: no redux store here. misc tab > "scan components", then paste the copied text');
  }

  // react exposes its root through any element's fiber; walk up to the top
  function fiberRoot() {
    for (const el of document.querySelectorAll('body *')) {
      const k = Object.keys(el).find(x => x.startsWith('__reactFiber$'));
      if (!k) continue;
      let f = el[k];
      while (f.return) f = f.return;
      return f;
    }
    return null;
  }

  function* fibers(root) {
    const stack = [root];
    while (stack.length) {
      const f = stack.pop();
      yield f;
      if (f.sibling) stack.push(f.sibling);
      if (f.child) stack.push(f.child);
    }
  }

  const INTEREST = /token|coin|gold|cash|money|tower|level|health|hp|wave|round|lives|upgrade|question|answer|correct/i;
  const compName = f => {
    const t = f.type;
    return typeof t === 'string' ? t : (t && (t.displayName || t.name)) || '?';
  };
  const brief = v => {
    if (v === null || typeof v !== 'object') return String(v);
    return '{' + Object.keys(v).slice(0, 20).map(k => {
      const x = v[k];
      return typeof x === 'number' || typeof x === 'boolean'
        ? `${k}=${x}` : `${k}:${Array.isArray(x) ? 'array' + x.length : typeof x}`;
    }).join(', ') + '}';
  };

  // lists where the game keeps its state: class component state, props and
  // hook values that look like tokens / towers / levels. copies it for pasting
  function scanFibers() {
    const root = fiberRoot();
    if (!root) return print('no react fiber found');
    const cls = [], props = [], hooks = [];
    for (const f of fibers(root)) {
      if (typeof f.type === 'string') continue;
      const name = compName(f);
      const inst = f.stateNode;
      const isClass = inst && typeof inst === 'object' && inst.state && typeof inst.setState === 'function';
      if (isClass) {
        cls.push(`[class ${name}] state ${brief(inst.state)}`);
        for (const k of Object.keys(inst.state)) {
          const v = inst.state[k];
          if (v && typeof v === 'object') cls.push(`[state ${name}.${k}] ${brief(v)}`);
        }
        if (typeof inst.state.tokens === 'number') {
          for (const h of deepFind(inst, /level|lvl|tier|upgrade|damage|range/i)) cls.push(`[deep ${name}] ${h}`);
        }
        const skip = ['props', 'context', 'refs', 'updater', 'state', '_reactInternals', '_reactInternalInstance'];
        const own = Object.keys(inst).filter(k => !skip.includes(k)).slice(0, 40);
        if (own.length) {
          cls.push(`[fields ${name}] ` + own.map(k => {
            const v = inst[k];
            return `${k}: ${v && typeof v === 'object' ? brief(v) : typeof v === 'function' ? 'fn' : String(v)}`;
          }).join(' | '));
        }
      }
      const p = f.memoizedProps;
      if (p && typeof p === 'object') {
        for (const k of Object.keys(p)) {
          if (INTEREST.test(k)) props.push(`[props ${name}] ${k} = ${brief(p[k])}`);
        }
      }
      if (isClass) continue;
      let i = 0;
      for (let h = f.memoizedState; h && typeof h === 'object' && 'next' in h; h = h.next, i++) {
        const v = h.memoizedState;
        if (typeof v === 'number') hooks.push(`[hook ${name}#${i}] ${v}`);
        else if (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).some(k => INTEREST.test(k))) {
          hooks.push(`[hook ${name}#${i}] ${brief(v)}`);
        }
      }
    }
    const lines = [...new Set([...cls, ...props, ...hooks])].slice(0, 300);
    const text = lines.join('\n');
    window.__dolpScan = text;
    print(`component scan: ${cls.length} class, ${props.length} props, ${hooks.length} hooks`);
    print(lines.slice(0, 10).join('\n'));
    const clip = navigator.clipboard && navigator.clipboard.writeText;
    if (!clip) return print('no clipboard api. full scan on window.__dolpScan');
    navigator.clipboard.writeText(text).then(
      () => { print('full scan copied. paste it into chat'); toast('scan copied', 'ok'); },
      () => print('clipboard denied. full scan on window.__dolpScan'));
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
  // upgrades go through the game's own upgradeTower (see "real upgrades" below);
  // writing tower.level only changes the number, not the stats
  function maxTowers(quiet = false) {
    const g = getGame();
    if (g && Array.isArray(g.towers)) return maxBySteps('all', quiet);
    if (!store || !HOOKS.setTowerLevel) {
      return quiet || toast('tower data not located yet. place towers, misc > scan components, paste it', 'bad');
    }
    let n = 0;
    for (const t of HOOKS.getTowers(state())) {
      if (t.level < t.maxLevel) { store.dispatch(HOOKS.setTowerLevel(t.id, t.maxLevel)); n++; }
    }
    if (!quiet) toast(n ? `maxed ${n} tower${n > 1 ? 's' : ''}` : 'nothing to max', n ? 'ok' : 'dim');
    return n;
  }

  // the tower defense page keeps its state in one class component whose state
  // has tokens, health and round, not in redux. component names are minified,
  // so it is found by the shape of its state
  let game = null;
  const alive = g => !!(g && g._reactInternals && g._reactInternals.return);
  function findGame() {
    const root = fiberRoot();
    if (!root) return null;
    for (const f of fibers(root)) {
      const i = f.stateNode;
      if (i && typeof i === 'object' && typeof i.setState === 'function' && i.state &&
          typeof i.state.tokens === 'number' && typeof i.state.health === 'number') return i;
    }
    return null;
  }
  const getGame = () => { if (!alive(game)) game = findGame(); return game; };

  function setTokens(amount, quiet = false) {
    const n = Number(amount) || 0;
    const g = getGame();
    if (g) {
      const mirrors = moneyFields(g);
      g.setState({ tokens: n });
      // the game subtracts purchases from stats.tokens, not from state.tokens, so both are set
      for (const m of mirrors) m.o[m.k] = n;
      if (!quiet) {
        print(`also set: ${mirrors.map(m => m.path).join(', ') || 'nothing else found'}`);
        setTimeout(() => print(`tokens after set: ${g.state.tokens}`), 150);
      }
      return quiet || toast(`tokens set to ${n}`, 'ok');
    }
    if (!store) return quiet || toast('game not found. start a round first', 'bad');
    if (!HOOKS.setTokens) return quiet || toast('tokens hook not filled', 'bad');
    store.dispatch(HOOKS.setTokens(n));
    if (!quiet) toast(`tokens set to ${n}`, 'ok');
  }

  function addTokens() {
    const step = Number(cfg.tokenStep) || 0;
    const g = getGame();
    if (g) {
      setTokens(g.state.tokens + step, true);
      return toast(`+${step} tokens`, 'ok');
    }
    if (!store) return toast('game not found. start a round first', 'bad');
    if (!HOOKS.getTokens || !HOOKS.setTokens) return toast('tokens hooks not filled', 'bad');
    store.dispatch(HOOKS.setTokens(HOOKS.getTokens(state()) + step));
    toast(`+${step} tokens`, 'ok');
  }

  function setHealth(amount, quiet = false) {
    const g = getGame();
    if (!g) return quiet || toast('game not found. start a round first', 'bad');
    g.setState({ health: Number(amount) || 0 });
    if (!quiet) toast(`health set to ${amount}`, 'ok');
  }

  const needGame = () => {
    const g = getGame();
    if (!g) toast('game not found. start a round first', 'bad');
    return g;
  };

  // prints what a tower object looks like and which game methods look relevant
  function inspectTowers() {
    const g = needGame();
    if (!g) return;
    const list = Array.isArray(g.towers) ? g.towers : [];
    print(`towers: ${list.length}`);
    const sample = list.length > 2 ? [list[0], list[1], list[list.length - 1]] : list;
    sample.forEach(t => {
      print(`tower ${list.indexOf(t)}: ${brief(t)}`);
      print('  numbers: ' + numFields(t).map(k => `${k}=${t[k]}`).join(', '));
    });
    const re = /tower|upgrade|buy|sell|place|round|correct|question|answer/i;
    const names = new Set([
      ...Object.getOwnPropertyNames(Object.getPrototypeOf(g)),
      ...Object.keys(g),
    ]);
    const methods = [...names].filter(k => re.test(k) && typeof g[k] === 'function');
    print('methods: ' + (methods.join(', ') || 'none'));
    print('max-ish fields: ' + (deepFind(g, /^max/i, 4, 20).join(' | ') || 'none'));
    const arrays = Object.keys(g).filter(k => Array.isArray(g[k])).map(k => {
      const first = g[k][0];
      return `${k}[${g[k].length}]` + (first && typeof first === 'object' ? ' ' + brief(first) : '');
    });
    print('arrays: ' + (arrays.join(' | ') || 'none'));
    print('enemy list: ' + (enemyList(g) ? enemyKey : 'not found (needs enemies on screen)'));
  }

  function setRound(n) {
    const g = needGame();
    if (!g) return;
    const r = Number(n) || 1;
    g.setState({ round: r });
    toast(`round set to ${r}`, 'ok');
  }

  function skipRound() {
    const g = needGame();
    if (!g) return;
    const next = g.state.round + 1;
    g.setState({ round: next, roundCompleted: true });
    toast(`round ${next}`, 'ok');
  }

  function revive() {
    const g = needGame();
    if (!g) return;
    g.setState({ gameOver: false, health: Math.max(g.state.health, Number(cfg.healthAmount) || 100) });
    toast('revived', 'ok');
  }

  function togglePause() {
    const g = needGame();
    if (!g) return;
    const was = g.state.paused;
    g.setState(s => ({ paused: !s.paused }));
    toast(was ? 'resumed' : 'paused', 'dim');
  }

  function toggleSpeed() {
    const g = needGame();
    if (!g) return;
    const was = g.state.doubleSpeed;
    g.setState(s => ({ doubleSpeed: !s.doubleSpeed }));
    toast(was ? '1x speed' : '2x speed', 'dim');
  }

  // the question component takes an onCorrect callback. calling it counts the
  // active question as answered correctly (solo only)
  function skipQuestion(quiet = false) {
    const root = fiberRoot();
    if (!root) return quiet || toast('no react fiber found', 'bad');
    let cb = null;
    for (const f of fibers(root)) {
      const p = f.memoizedProps;
      if (p && typeof p.onCorrect === 'function') {
        cb = p.onCorrect;
        if (p.numCorrectsGoal != null) break;
      }
    }
    if (!cb) return quiet || toast('no question component found', 'bad');
    cb();
    if (!quiet) toast('question counted correct', 'ok');
  }

  // numeric fields on the game instance (outside react state/props) named like
  // money. if the game checks purchases against one of these instead of
  // state.tokens, setting state alone shows coins but buying still fails
  function moneyFields(g, exact = /^(tokens?|coins?|gold|money|cash|balance|currency)$/i, maxDepth = 4) {
    const hits = [];
    const seen = new WeakSet();
    const skip = new Set(['_reactInternals', '_reactInternalInstance', 'props', 'refs', 'updater', 'context', 'state']);
    const walk = (o, path, d) => {
      if (!o || typeof o !== 'object' || Array.isArray(o) || d > maxDepth || seen.has(o) || hits.length >= 20) return;
      if (o === window || (typeof Node !== 'undefined' && o instanceof Node)) return;
      seen.add(o);
      for (const k of Object.keys(o)) {
        if (d === 0 && skip.has(k)) continue;
        let v;
        try { v = o[k]; } catch (_) { continue; }
        const p = path ? `${path}.${k}` : k;
        if (typeof v === 'number' && exact.test(k)) hits.push({ o, k, path: p });
        else if (v && typeof v === 'object') walk(v, p, d + 1);
      }
    };
    walk(g, '', 0);
    return hits;
  }

  // logs every change in the game's state (and tower count) to the log box,
  // so clicking a shop tile shows exactly which fields the game touches
  let prevState = null;
  function watchState(g) {
    const cur = { towers: Array.isArray(g.towers) ? g.towers.length : '-' };
    for (const [k, v] of Object.entries(g.state)) cur[k] = v && typeof v === 'object' ? brief(v) : v;
    if (prevState) {
      for (const k of Object.keys(cur)) {
        if (cur[k] !== prevState[k]) print(`${k}: ${prevState[k]} -> ${cur[k]}`);
      }
    }
    prevState = cur;
  }

  // wraps the game's tower/buy/upgrade-looking methods so each call, its
  // arguments and its return value are logged, and turns the state logger on.
  // click a shop tile and the map afterwards and read the log
  let tracedFor = null;

  // the board is drawn with p5. a tower object carries its p5 instance, so
  // wrap the mouse handlers there to see whether a map click reaches the game
  const p5Wrapped = new WeakSet();
  function wrapP5(p, g) {
    p5Wrapped.add(p);
    const names = [];
    for (const k of ['mousePressed', 'mouseReleased', 'mouseClicked']) {
      const orig = p[k];
      if (typeof orig !== 'function') continue;
      p[k] = function (...a) {
        print(`p5.${k} at ${Math.round(p.mouseX)},${Math.round(p.mouseY)}`);
        const r = orig.apply(this, a);
        print(`towers now ${Array.isArray(g.towers) ? g.towers.length : '?'}`);
        return r;
      };
      names.push(k);
    }
    print(`p5 handlers wrapped: ${names.join(', ') || 'none'}`);
  }
  function traceMethods() {
    const g = needGame();
    if (!g) return;
    if (tracedFor !== g) {
      const re = /tower|upgrade|buy|sell|place|afford|cost|token|purchase/i;
      const show = x => (typeof x === 'function' ? 'fn' : brief(x)).slice(0, 120);
      const names = new Set([...Object.getOwnPropertyNames(Object.getPrototypeOf(g)), ...Object.keys(g)]);
      const wrapped = [];
      const counts = {};
      for (const k of names) {
        let orig;
        try { orig = g[k]; } catch (_) { continue; }
        if (!re.test(k) || typeof orig !== 'function' || k === 'setState' || k === 'forceUpdate') continue;
        g[k] = function (...a) {
          // per-frame methods would bury everything else: log each one 3 times, then mute it
          counts[k] = (counts[k] || 0) + 1;
          const loud = counts[k] <= 3;
          if (loud) print(`call ${k}(${a.map(show).join(', ')})`);
          const r = orig.apply(this, a);
          if (loud) print(`${k} -> ${show(r)}`);
          if (counts[k] === 4) print(`${k} muted (called every frame)`);
          if (r && r.p5 && typeof r.p5 === 'object' && !p5Wrapped.has(r.p5)) wrapP5(r.p5, g);
          return r;
        };
        wrapped.push(k);
      }
      tracedFor = g;
      print(`tracing: ${wrapped.join(', ') || 'no matching methods'}`);
      if (typeof g.forceUpdate === 'function') g.forceUpdate();
    }
    cfg.watchState = true;
    saveCfg(); syncFields();
    toast('tracing on. click a tile, then the map', 'ok');
  }

  // ---------- damage multiplier ----------
  // towers have no damage field (stats come from name + level inside the game),
  // so the multiplier works on the receiving end: every frame, any enemy whose
  // health dropped gets the extra (mult - 1) x that drop taken off as well.
  // the enemy list is found by shape: an array on the game with health/hp numbers
  let enemyKey = null;
  let enemyFor = null;
  function enemyList(g) {
    if (enemyFor !== g) { enemyFor = g; enemyKey = null; }
    if (enemyKey && Array.isArray(g[enemyKey])) return g[enemyKey];
    for (const k of Object.keys(g)) {
      const v = g[k];
      if (k === 'towers' || !Array.isArray(v) || !v.length) continue;
      const e = v[0];
      if (e && typeof e === 'object' && (typeof e.health === 'number' || typeof e.hp === 'number')) {
        enemyKey = k;
        return v;
      }
    }
    return null;
  }

  const seenHp = new WeakMap();
  function boostDamage() {
    requestAnimationFrame(boostDamage);
    const m = Number(cfg.damageMult);
    if (!cfg.damageBoost || !m || m === 1 || !alive(game)) return;
    const list = enemyList(game);
    if (!list) return;
    for (const e of list) {
      if (!e || typeof e !== 'object') continue;
      const k = typeof e.health === 'number' ? 'health' : typeof e.hp === 'number' ? 'hp' : null;
      if (!k) continue;
      const prev = seenHp.get(e);
      if (prev !== undefined && e[k] < prev) e[k] -= (prev - e[k]) * (m - 1);
      seenHp.set(e, e[k]);
    }
  }
  requestAnimationFrame(boostDamage);

  // ---------- invincible / drag place / matching upgrades / bulk delete ----------
  const INVINCIBLE_HP = 999999;
  const HEALTH_RE = /^(health|hp|lives|life)$/i;

  // rewrites setState updates that lower health or set gameOver before react sees them
  function lockHealth(g) {
    if (g.__dolpLock) return;
    g.__dolpLock = true;
    const real = g.setState.bind(g);
    const fix = p => {
      if (!cfg.invincible || !p || typeof p !== 'object') return p;
      const out = { ...p };
      if (typeof out.health === 'number' && out.health < INVINCIBLE_HP) out.health = INVINCIBLE_HP;
      if (out.gameOver === true) out.gameOver = false;
      return out;
    };
    g.setState = (upd, cb) => real(typeof upd === 'function' ? (s, p) => fix(upd(s, p)) : fix(upd), cb);
  }

  // remembers which shop tile picked the current tower, so drag-place can pick it again
  let tileEl = null;
  let chosen = '';
  let prevName = '';
  document.addEventListener('click', e => {
    if (panel.contains(e.target)) return;
    const el = e.target;
    setTimeout(() => {
      const g = getGame();
      const name = (g && g.state.buyTowerName) || '';
      if (name && name !== prevName) { tileEl = el; chosen = name; }
      prevName = name;
    }, 60);
  }, true);

  // while the left button is held on the board, try to place the chosen tower
  // under the cursor. buyTower() uses the held tower's position, which follows
  // the mouse, so a short delay lets the preview catch up first
  let dragging = false;
  let placing = false;
  window.addEventListener('mousedown', e => {
    dragging = e.button === 0 && !!e.target && e.target.tagName === 'CANVAS';
  }, true);
  window.addEventListener('mouseup', () => { dragging = false; }, true);
  window.addEventListener('mousemove', () => {
    if (!cfg.dragPlace || !dragging || placing) return;
    placing = true;
    setTimeout(() => { try { placeAtMouse(); } finally { placing = false; } }, 50);
  }, true);

  function placeAtMouse() {
    const g = getGame();
    if (!g || typeof g.buyTower !== 'function') return;
    if (!g.state.buyTowerName) {
      if (!tileEl || !document.contains(tileEl)) return;
      tileEl.click();
      setTimeout(() => g.buyTower(), 70);
      return;
    }
    g.buyTower();
  }

  // ---------- real upgrades: record by hand, replay on other towers ----------
  // writing tower.level only changes the number shown, not the stats, so
  // upgrades go through the game's own upgradeTower. every upgrade done by
  // hand is recorded as steps[towerName][levelBefore] = arguments, then
  // replayed on other towers with that tower swapped in as the selection
  const steps = {};
  const stepCount = () => Object.values(steps).reduce((n, s) => n + Object.keys(s).length, 0);

  function installUpgradeSync(g) {
    if (g.__dolpUpg || typeof g.upgradeTower !== 'function') return;
    g.__dolpUpg = true;
    const raw = g.upgradeTower;
    g.__dolpRaw = raw;
    g.upgradeTower = function (...a) {
      const self = this || g;
      const sel = self.state.towerSelected;
      const before = sel && typeof sel.level === 'number' ? sel.level : null;
      const r = raw.apply(self, a);
      if (before !== null && sel.name) {
        setTimeout(() => {
          if (sel.level <= before) return;
          (steps[sel.name] = steps[sel.name] || {})[before] = a;
          if (cfg.syncUpgrades) syncSiblings(sel, before);
        }, 40);
      }
      return r;
    };
    if (typeof g.forceUpdate === 'function') g.forceUpdate();
  }

  // one level up for tower t through the game's own function. returns 'ok' or why it stopped
  function upgradeOnce(g, t) {
    const a = steps[t.name] && steps[t.name][t.level];
    const raw = g.__dolpRaw;
    if (!a || !raw) return 'nostep';
    const prev = g.state.towerSelected;
    const prevLevel = prev && prev.level;
    const before = t.level;
    g.state.towerSelected = t;
    try { raw.apply(g, a); } catch (_) { return 'error'; } finally { g.state.towerSelected = prev; }
    if (t.level > before) return 'ok';
    return prev && prev !== t && prev.level > prevLevel ? 'wrongtarget' : 'noeffect';
  }

  const stopMsg = {
    wrongtarget: 'the game upgraded the selected tower, not the swapped one. replay is not possible',
    noeffect: 'replay changed nothing',
    error: 'replay threw an error',
  };

  // a failed replay in a loop would repeat every second, so it turns auto max off
  function replayFailed(r, quiet) {
    if (quiet) { cfg.autoMax = false; saveCfg(); syncFields(); }
    toast(stopMsg[r], 'bad');
  }

  function syncSiblings(sel, before) {
    const g = getGame();
    if (!g || !Array.isArray(g.towers)) return;
    let n = 0;
    for (const t of g.towers) {
      if (!t || t === sel || t.name !== sel.name || t.level !== before) continue;
      const r = upgradeOnce(g, t);
      if (r === 'ok') { n++; continue; }
      if (r !== 'nostep') { replayFailed(r, false); break; }
    }
    if (n) toast(`${n} matching tower${n > 1 ? 's' : ''} upgraded`, 'ok');
  }

  // scope: 'all' | 'type' (same name as the selected tower) | 'selected'
  function maxBySteps(scope, quiet = false) {
    const g = getGame();
    if (!g || !Array.isArray(g.towers)) return quiet || toast('game not found. start a round first', 'bad');
    const sel = g.state.towerSelected;
    let list = g.towers;
    if (scope !== 'all') {
      if (!sel || !sel.name) return quiet || toast('select a tower first', 'bad');
      list = scope === 'type' ? g.towers.filter(t => t && t.name === sel.name) : [sel];
    }
    let n = 0;
    for (const t of list) {
      if (!t || typeof t.level !== 'number') continue;
      for (let guard = 0; guard < 25; guard++) {
        const r = upgradeOnce(g, t);
        if (r === 'ok') { n++; continue; }
        if (r === 'nostep') break;
        replayFailed(r, quiet);
        return n;
      }
    }
    if (!quiet) {
      if (n) toast(`${n} upgrade${n > 1 ? 's' : ''} applied`, 'ok');
      else toast(stepCount() ? 'nothing left to upgrade' : 'upgrade a tower by hand first: each step is recorded and replayed',
        stepCount() ? 'dim' : 'bad');
    }
    return n;
  }

  // ---------- buffs: scale a numeric field on selected / same type / all towers ----------
  // each tower remembers its original value per field, so applying again
  // rescales from the original instead of compounding
  const buffRec = new WeakMap();
  const numFields = t => Object.keys(t).filter(k => typeof t[k] === 'number');

  function pickField(re, label) {
    const g = needGame();
    if (!g) return;
    const sel = g.state.towerSelected;
    if (!sel || !sel.name) return toast('select a tower first', 'bad');
    const k = numFields(sel).find(f => re.test(f));
    if (!k) return toast(`no ${label} field found. try list fields`, 'bad');
    cfg.buffField = k;
    saveCfg(); syncFields();
    const cooldown = /cool|^cd$|delay|interval/i.test(k);
    toast(`field ${k} = ${sel[k]}${cooldown ? '. lower is faster: use a multiplier under 1' : ''}`, 'ok');
  }
  const buffRange = () => pickField(/range|radius/i, 'range');
  const buffSpeed = () => pickField(/speed|rate|cool|^cd$|delay|interval/i, 'speed');
  const buffDamage = () => pickField(/damage|dmg|power|atk|attack/i, 'damage');

  function listFields() {
    const g = needGame();
    if (!g) return;
    const sel = g.state.towerSelected;
    if (!sel || !sel.name) return toast('select a tower first', 'bad');
    print(`${sel.name} number fields: ` + numFields(sel).map(k => `${k}=${sel[k]}`).join(', '));
  }

  function applyBuff(quiet = false) {
    const g = getGame();
    if (!g || !Array.isArray(g.towers)) return quiet || toast('game not found. start a round first', 'bad');
    const f = String(cfg.buffField || '').trim();
    const m = Number(cfg.buffMult);
    if (!f || !m) return quiet || toast('set a field and a multiplier', 'bad');
    const sel = g.state.towerSelected;
    let targets;
    if (cfg.buffScope === 'all') targets = g.towers;
    else if (!sel || !sel.name) return quiet || toast('select a tower first', 'bad');
    else targets = cfg.buffScope === 'type' ? g.towers.filter(t => t && t.name === sel.name) : [sel];
    let n = 0;
    for (const t of targets) {
      if (!t || typeof t[f] !== 'number') continue;
      let rec = buffRec.get(t);
      if (!rec) buffRec.set(t, rec = {});
      const r = rec[f];
      // if the game changed the value since our last write (an upgrade), that is the new base
      const base = r && t[f] === r.last ? r.base : t[f];
      const next = base * m;
      t[f] = next;
      rec[f] = { base, last: next };
      n++;
    }
    if (!quiet) toast(n ? `${f} x${m} on ${n} tower${n > 1 ? 's' : ''}` : `no tower has a number field "${f}"`, n ? 'ok' : 'bad');
  }

  function resetBuffs() {
    const g = getGame();
    if (!g || !Array.isArray(g.towers)) return;
    let n = 0;
    for (const t of [...g.towers, g.state.towerSelected]) {
      const rec = t && buffRec.get(t);
      if (!rec) continue;
      for (const [f, r] of Object.entries(rec)) if (t[f] === r.last) { t[f] = r.base; n++; }
      buffRec.delete(t);
    }
    toast(n ? `reset ${n} buff${n > 1 ? 's' : ''}` : 'no buffs to reset', n ? 'ok' : 'dim');
  }

  function removeTowers(pred, label) {
    const g = needGame();
    if (!g) return;
    if (!Array.isArray(g.towers)) return toast('tower list not found', 'bad');
    let n = 0;
    for (let i = g.towers.length - 1; i >= 0; i--) {
      const t = g.towers[i];
      if (!pred(t)) continue;
      try { t.alive = false; } catch (_) {}
      g.towers.splice(i, 1);
      n++;
    }
    if (n) g.setState({ towerSelected: {} });
    if (n && typeof g.forceUpdate === 'function') g.forceUpdate();
    toast(n ? `removed ${n} (${label})` : 'nothing to remove', n ? 'ok' : 'dim');
  }
  const deleteAll = () => removeTowers(() => true, 'all');
  const deleteSelected = () => {
    const g = getGame();
    const sel = g && g.state.towerSelected;
    removeTowers(t => t === sel, 'selected');
  };
  const deleteMatching = () => {
    const g = getGame();
    const sel = g && g.state.towerSelected;
    if (!sel || !sel.name) return toast('select a tower first', 'bad');
    removeTowers(t => t && t.name === sel.name, sel.name);
  };

  // clicks the "Next Round" button when it is on screen
  let lastNext = 0;
  const ownText = e => [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('');
  function clickNext() {
    if (Date.now() - lastNext < 1500) return;
    const el = [...document.querySelectorAll('button, [role=button], div, span')]
      .find(e => !panel.contains(e) && /^\s*next( round)?\s*$/i.test(ownText(e)));
    if (!el) return;
    lastNext = Date.now();
    el.click();
  }

  // numeric/string fields named like levels or stats anywhere under an object,
  // skipping react internals and dom nodes. used by the scan to find towers
  function deepFind(root, re, maxDepth = 5, limit = 80) {
    const hits = [];
    const seen = new WeakSet();
    const skip = new Set(['_reactInternals', '_reactInternalInstance', 'props', 'refs', 'updater', 'context']);
    const walk = (o, path, d) => {
      if (!o || typeof o !== 'object' || d > maxDepth || seen.has(o) || hits.length >= limit) return;
      if (o === window || (typeof Node !== 'undefined' && o instanceof Node)) return;
      seen.add(o);
      for (const k of Object.keys(o)) {
        if (skip.has(k)) continue;
        let v;
        try { v = o[k]; } catch (_) { continue; }
        const p = path ? `${path}.${k}` : k;
        if (re.test(k) && (typeof v === 'number' || typeof v === 'string')) hits.push(`${p} = ${v}`);
        else if (v && typeof v === 'object') walk(v, p, d + 1);
      }
    };
    walk(root, '', 0);
    return hits;
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

  // ---------- stats: dps from the game's own totalDamage counter ----------
  const fmt = n => (typeof n !== 'number' || !isFinite(n) ? '-'
    : Math.abs(n) >= 1e9 ? n.toExponential(2) : Math.round(n).toLocaleString());
  const dmgLog = [];
  let dps = 0;
  let peakDps = 0;
  let dmgStart = null;
  let statsStart = Date.now();

  function statsTick(g) {
    const d = g.state.totalDamage;
    if (typeof d !== 'number') return;
    const now = Date.now();
    if (dmgStart === null) dmgStart = d;
    dmgLog.push({ t: now, d });
    while (dmgLog.length > 1 && now - dmgLog[0].t > 5000) dmgLog.shift();
    const f = dmgLog[0];
    dps = now > f.t ? Math.max(0, (d - f.d) / ((now - f.t) / 1000)) : 0;
    if (dps > peakDps) peakDps = dps;
  }

  function resetStats() {
    dmgLog.length = 0;
    dps = 0; peakDps = 0; dmgStart = null; statsStart = Date.now();
    toast('stats reset', 'dim');
  }

  // ---------- enemies (list found by shape in enemyList) ----------
  function nukeEnemies() {
    const g = needGame();
    if (!g) return;
    const list = enemyList(g);
    if (!list) return toast('enemy list not found. needs enemies on screen', 'bad');
    let n = 0;
    for (const e of list) {
      const k = e && typeof e === 'object' && (typeof e.health === 'number' ? 'health' : typeof e.hp === 'number' ? 'hp' : null);
      if (k) { e[k] = 0; n++; }
    }
    toast(n ? `${n} enem${n > 1 ? 'ies' : 'y'} down` : 'no enemies with health', n ? 'ok' : 'dim');
  }

  // scales an enemy's speed-like field every frame, from the original value.
  // if the game rewrites its own value each frame, that value becomes the base
  const slowRec = new WeakMap();
  const slowed = new Set();
  function enemyLoop() {
    requestAnimationFrame(enemyLoop);
    const m = Number(cfg.slowMult);
    if (!cfg.slowEnemies || !m || m < 0 || !alive(game)) {
      if (slowed.size) {
        for (const e of slowed) {
          const r = slowRec.get(e);
          if (r && e[r.f] === r.last) e[r.f] = r.base;
        }
        slowed.clear();
      }
      return;
    }
    const list = enemyList(game);
    if (!list) return;
    if (slowed.size > 300) slowed.clear();
    for (const e of list) {
      if (!e || typeof e !== 'object') continue;
      const f = Object.keys(e).find(k => /speed|^spd$|vel/i.test(k) && typeof e[k] === 'number');
      if (!f) continue;
      const r = slowRec.get(e);
      const base = r && e[f] === r.last ? r.base : e[f];
      const next = base * m;
      e[f] = next;
      slowRec.set(e, { f, base, last: next });
      slowed.add(e);
    }
  }
  requestAnimationFrame(enemyLoop);

  // ---------- turbo frame rate (p5 instance rides on tower objects) ----------
  function p5Of(g) {
    const t = (g.towers || []).find(x => x && x.p5);
    const p = (t && t.p5) || (g.state.buyTower && g.state.buyTower.p5) || (g.state.towerSelected && g.state.towerSelected.p5);
    return p && typeof p.frameRate === 'function' ? p : null;
  }
  function setFps(n, quiet = false) {
    const g = getGame();
    const p = g && p5Of(g);
    if (!p) return quiet || toast('board not found. place a tower first', 'bad');
    const v = Math.max(1, Math.min(240, Number(n) || 60));
    p.frameRate(v);
    if (!quiet) toast(`frame rate ${v}`, 'ok');
  }

  // ---------- snapshots (numbers only) ----------
  const SNAP_KEY = 'dolp-blooket-snap';
  function saveSnap() {
    const g = needGame();
    if (!g) return;
    const s = { tokens: g.state.tokens, health: g.state.health, round: g.state.round };
    try { localStorage.setItem(SNAP_KEY, JSON.stringify(s)); } catch (_) { return toast('storage blocked', 'bad'); }
    toast(`saved: ${fmt(s.tokens)} tokens, round ${s.round}`, 'ok');
  }
  function restoreSnap() {
    const g = needGame();
    if (!g) return;
    let s = null;
    try { s = JSON.parse(localStorage.getItem(SNAP_KEY)); } catch (_) {}
    if (!s) return toast('no snapshot saved', 'bad');
    setTokens(s.tokens, true);
    setHealth(s.health, true);
    g.setState({ round: s.round });
    toast('snapshot restored', 'ok');
  }

  // ---------- config profiles ----------
  const PROF_KEY = 'dolp-blooket-profiles';
  const readProfiles = () => { try { return JSON.parse(localStorage.getItem(PROF_KEY)) || {}; } catch (_) { return {}; } };
  const writeProfiles = p => { try { localStorage.setItem(PROF_KEY, JSON.stringify(p)); } catch (_) {} };
  const profName = () => String(cfg.profile || '').trim();
  function saveProfile() {
    const n = profName();
    if (!n) return toast('name the profile first', 'bad');
    const all = readProfiles();
    const copy = { ...cfg };
    delete copy.profile;
    all[n] = copy;
    writeProfiles(all);
    toast(`saved "${n}"`, 'ok');
  }
  function loadProfile() {
    const n = profName();
    const p = readProfiles()[n];
    if (!p) return toast('no profile with that name', 'bad');
    Object.assign(cfg, DEFAULTS, p, { profile: n });
    saveCfg(); syncFields();
    toast(`loaded "${n}"`, 'ok');
  }
  function deleteProfile() {
    const n = profName();
    const all = readProfiles();
    if (!all[n]) return toast('no profile with that name', 'bad');
    delete all[n];
    writeProfiles(all);
    toast(`deleted "${n}"`, 'dim');
  }
  const listProfiles = () => print('profiles: ' + (Object.keys(readProfiles()).join(', ') || 'none'));

  // ---------- kill switch ----------
  const AUTO_FLAGS = ['autoMax', 'autoTokens', 'autoHealth', 'invincible', 'dragPlace', 'syncUpgrades',
    'damageBoost', 'autoAnswer', 'autoNext', 'force2x', 'buffAuto', 'watchState', 'autoRevive', 'autoSkip',
    'slowEnemies', 'turbo', 'logDispatch'];
  function killAll() {
    for (const k of AUTO_FLAGS) cfg[k] = false;
    saveCfg(); syncFields();
    resetBuffs();
    setFps(60, true);
    panel.classList.remove('open');
    toast('everything off', 'dim');
  }

  // ---------- actions (buttons) ----------
  const actions = {
    maxTowers: () => maxTowers(false),
    setTokens: () => setTokens(cfg.tokenAmount),
    setHealth: () => setHealth(cfg.healthAmount),
    setRound: () => setRound(cfg.roundTarget),
    skipRound, revive, togglePause, toggleSpeed, skipQuestion, inspectTowers,
    traceBuy: traceMethods,
    maxType: () => maxBySteps('type', false),
    maxSel: () => maxBySteps('selected', false),
    applyBuff: () => applyBuff(false),
    resetBuffs, buffRange, buffSpeed, buffDamage, listFields,
    nuke: nukeEnemies,
    applyFps: () => setFps(cfg.fps),
    resetFps: () => setFps(60),
    saveSnap, restoreSnap, resetStats, killAll,
    saveProfile, loadProfile, deleteProfile, listProfiles,
    deleteAll, deleteSelected, deleteMatching,
    addTokens,
    answerNow: () => autoAnswer(false, true),
    scan: doScan,
    dump: doDump,
    hookTest,
    scanFibers,
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
    if (e.key === 'k' || e.key === 'K') return killAll();
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
    chosenEl.textContent = chosen || 'none: click a shop tile once';
    stepsEl.textContent = stepCount();
    const g = getGame();
    const setText = (sel, v) => { const el = panel.querySelector(sel); if (el) el.textContent = v; };
    const secs = Math.floor((Date.now() - statsStart) / 1000);
    setText('[data-stat="time"]', `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`);
    setText('[data-stat="steps"]', stepCount());
    if (g) {
      setText('[data-chip="tokens"]', fmt(g.state.tokens));
      setText('[data-chip="health"]', fmt(g.state.health));
      setText('[data-chip="round"]', g.state.round);
      setText('[data-chip="towers"]', Array.isArray(g.towers) ? g.towers.length : '-');
      setText('[data-chip="dps"]', fmt(dps));
      setText('[data-stat="dps"]', fmt(dps));
      setText('[data-stat="peak"]', fmt(peakDps));
      setText('[data-stat="total"]', dmgStart === null ? '-' : fmt(g.state.totalDamage - dmgStart));
      const en = enemyList(g);
      setText('[data-stat="enemies"]', en ? en.length : 'not found');
    }
    if (!g && !store) return;
    const parts = [];
    try {
      if (g) parts.push(`tokens ${g.state.tokens}`, `health ${g.state.health}`, `round ${g.state.round}`);
      if (g && Array.isArray(g.towers)) {
        parts.push(`towers ${g.towers.length} [lv ${g.towers.slice(0, 8).map(t => t && t.level).join(',')}]`);
      }
      if (store && HOOKS.getTokens) parts.push(`tokens ${HOOKS.getTokens(state())}`);
      if (store && HOOKS.getTowers) {
        const towers = HOOKS.getTowers(state());
        const maxed = towers.filter(t => t.level >= t.maxLevel).length;
        parts.push(`towers ${towers.length} (${maxed} maxed)`);
      }
      if (lastAnswer) parts.push(lastAnswer);
    } catch (e) { parts.push(`hook error: ${e.message}`); }
    statusEl.textContent = parts.length ? 'status: ' + parts.join(' | ') : 'status: hooks not filled';
  };

  // store isn't mounted at document-idle on every page, so poll for it
  // the game component only exists while a round page is open, so it is looked
  // up on every tick. a redux store (other pages) is picked up the same way
  let tries = 0;
  let seenGame = false;
  let lastSkip = 0;
  toast('dolp loaded. press P', 'ok');
  setInterval(() => {
    if (!store) store = findStore();
    if (store) wrapDispatch();
    const g = getGame();
    dot.classList.toggle('ok', !!(store || g));
    if (g && !seenGame) { seenGame = true; print('game component found'); toast('game found', 'ok'); }
    if (!g) seenGame = false;
    if (!store && !g && ++tries === 20) { print('no store or game after 10s'); diagnose(); }
    if (cfg.autoMax) maxTowers(true);
    if (cfg.autoTokens) setTokens(cfg.tokenAmount, true);
    if (cfg.autoHealth) setHealth(cfg.healthAmount, true);
    if (cfg.force2x && g && !g.state.doubleSpeed) g.setState({ doubleSpeed: true });
    if (cfg.autoNext) clickNext();
    if (g && cfg.invincible) {
      lockHealth(g);
      if (g.state.health < INVINCIBLE_HP) g.setState({ health: INVINCIBLE_HP });
      // a health copy outside state (shallow only, never the enemy list)
      for (const m of moneyFields(g, HEALTH_RE, 1)) if (m.o[m.k] < INVINCIBLE_HP) m.o[m.k] = INVINCIBLE_HP;
    }
    if (g) installUpgradeSync(g);
    if (cfg.buffAuto) applyBuff(true);
    if (cfg.watchState && g) watchState(g); else prevState = null;
    if (cfg.autoAnswer) autoAnswer(true);
    if (g && cfg.autoRevive && g.state.gameOver) {
      g.setState({ gameOver: false, health: Math.max(1, Number(cfg.healthAmount) || 100) });
    }
    if (cfg.autoSkip && Date.now() - lastSkip > 1200) { lastSkip = Date.now(); skipQuestion(true); }
    if (g && cfg.turbo) setFps(cfg.fps, true);
    if (g) statsTick(g);
    refreshStatus();
  }, 500);
})();
