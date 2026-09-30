'use strict';

/* ================= constants ================= */
const STORE_KEY = 'xufeibu:v1';
const CYCLES = {
  week: { label: '周付', unit: '周' },
  month: { label: '月付', unit: '月', months: 1 },
  quarter: { label: '季付', unit: '季', months: 3 },
  halfyear: { label: '半年付', unit: '半年', months: 6 },
  year: { label: '年付', unit: '年', months: 12 }
};
const CURRENCIES = {
  CNY: { sym: '¥', name: '人民币' },
  USD: { sym: '$', name: '美元' },
  HKD: { sym: 'HK$', name: '港币' },
  EUR: { sym: '€', name: '欧元' },
  GBP: { sym: '£', name: '英镑' },
  JPY: { sym: 'JP¥', name: '日元' }
};
const DEFAULT_RATES = { CNY: 1, USD: 7.1, HKD: 0.91, EUR: 8.3, GBP: 9.5, JPY: 0.048 };
const LEADS = [0, 1, 3, 7];
const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)');

/* ================= utilities ================= */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const pad = (n) => String(n).padStart(2, '0');
const nowStamp = () => new Date().toISOString();

function supportsFlexGap() {
  const probe = document.createElement('div');
  probe.style.cssText = 'display:flex;flex-direction:column;row-gap:1px;position:absolute;visibility:hidden';
  const child = document.createElement('span');
  child.style.height = '1px';
  probe.appendChild(child.cloneNode());
  probe.appendChild(child);
  document.body.appendChild(probe);
  const supported = probe.scrollHeight === 3;
  probe.remove();
  return supported;
}

function parseD(iso) { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); }
function toISO(dt) { return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate()); }
function todayISO() { return toISO(new Date()); }
function isISO(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }
function daysBetween(a, b) { return Math.round((parseD(b) - parseD(a)) / 86400000); }
function addDays(iso, n) { const d = parseD(iso); d.setDate(d.getDate() + n); return toISO(d); }
function addCycle(iso, cycle, times = 1) {
  const d = parseD(iso);
  if (cycle === 'week') { d.setDate(d.getDate() + 7 * times); return toISO(d); }
  const months = (CYCLES[cycle] || CYCLES.month).months * times;
  const day = d.getDate();
  const t = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  t.setDate(Math.min(day, last));
  return toISO(t);
}
function fmtDate(iso) {
  if (!iso) return '—';
  const d = parseD(iso);
  return (d.getFullYear() === new Date().getFullYear() ? '' : d.getFullYear() + '年') + (d.getMonth() + 1) + '月' + d.getDate() + '日';
}
function fmtDateFull(iso) { const d = parseD(iso); return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日'; }
function fmtNum(n) { return Number(n || 0).toLocaleString('zh-CN', { maximumFractionDigits: 2 }); }
function money(currency, amount) { return (CURRENCIES[currency] || CURRENCIES.CNY).sym + ' ' + fmtNum(amount); }
function unitOf(cycle) { return (CYCLES[cycle] || CYCLES.month).unit; }

/* ================= icons ================= */
const GLYPHS = {
  grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8"/>',
  list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.75" cy="6.5" r=".9"/><circle cx="4.75" cy="12" r=".9"/><circle cx="4.75" cy="17.5" r=".9"/>',
  bell: '<path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.75H5z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  calendar: '<rect x="3.75" y="5" width="16.5" height="15" rx="2.5"/><path d="M3.75 9.75h16.5M8 3v4M16 3v4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M5.5 12.5l4 4 9-9"/>',
  clock: '<circle cx="12" cy="12" r="8.25"/><path d="M12 7.5V12l3 2"/>',
  alert: '<circle cx="12" cy="12" r="8.25"/><path d="M12 7.75v5"/><circle cx="12" cy="16" r=".6"/>',
  pause: '<circle cx="12" cy="12" r="8.25"/><path d="M10 9v6M14 9v6"/>',
  more: '<circle cx="5.5" cy="12" r="1.1"/><circle cx="12" cy="12" r="1.1"/><circle cx="18.5" cy="12" r="1.1"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  edit: '<path d="M4.5 19.5l1-4L15.75 5.25a2 2 0 0 1 2.83 0l.17.17a2 2 0 0 1 0 2.83L8.5 18.5z"/><path d="M13.5 7.5l3 3"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.75h5V7M6.5 7l.9 12.25h9.2L17.5 7"/>',
  folder: '<path d="M3.75 7.5V6a1.5 1.5 0 0 1 1.5-1.5h4l2 2.25h7.5a1.5 1.5 0 0 1 1.5 1.5v9.5a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5z"/>',
  upload: '<path d="M12 15.5V4.5M7.5 9L12 4.5 16.5 9M5 15v3.25A1.75 1.75 0 0 0 6.75 20h10.5A1.75 1.75 0 0 0 19 18.25V15"/>',
  download: '<path d="M12 4.5v11M7.5 11l4.5 4.5 4.5-4.5M5 15v3.25A1.75 1.75 0 0 0 6.75 20h10.5A1.75 1.75 0 0 0 19 18.25V15"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.25M12 18.25v2.25M3.5 12h2.25M18.25 12h2.25M6 6l1.6 1.6M16.4 16.4L18 18M6 18l1.6-1.6M16.4 7.6L18 6"/>',
  renew: '<path d="M19 12a7 7 0 1 1-2.05-4.95"/><path d="M19.25 4.5v3.5h-3.5"/>',
  play: '<circle cx="12" cy="12" r="8.25"/><path d="M10.25 8.75v6.5L15.5 12z"/>',
  up: '<path d="M7 14l5-5 5 5"/>',
  down: '<path d="M7 10l5 5 5-5"/>',
  sparkle: '<path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z"/><path d="M18.5 16l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
  ticket: '<path d="M3.75 7.5A1.5 1.5 0 0 1 5.25 6h13.5a1.5 1.5 0 0 1 1.5 1.5v2.25a2.25 2.25 0 0 0 0 4.5v2.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-2.25a2.25 2.25 0 0 0 0-4.5z"/><path d="M15 6.5v1.5M15 11.25v1.5M15 16v1.5"/>'
};
function icon(name, size = 18) {
  return `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${GLYPHS[name] || ''}</svg>`;
}

/* ================= state ================= */
function emptyState() {
  return { version: 1, categories: [], subs: [], deleted: [], settings: { rates: Object.assign({}, DEFAULT_RATES), soonWindow: 7, defaultLead: 3, view: 'card' } };
}
function normalize(raw) {
  const s = emptyState();
  if (!raw || typeof raw !== 'object') return s;
  if (Array.isArray(raw.categories)) s.categories = raw.categories.filter((c) => c && c.id && c.name).map((c, i) => ({ id: String(c.id), name: String(c.name), order: Number.isFinite(c.order) ? c.order : i, updatedAt: c.updatedAt || nowStamp() }));
  if (Array.isArray(raw.subs)) s.subs = raw.subs.filter((x) => x && x.id && x.name).map(normalizeSub);
  if (Array.isArray(raw.deleted)) s.deleted = raw.deleted.filter((d) => d && d.id);
  if (raw.settings) {
    Object.assign(s.settings, raw.settings);
    s.settings.rates = Object.assign({}, DEFAULT_RATES, raw.settings.rates || {});
  }
  return s;
}
function normalizeSub(x) {
  return {
    id: String(x.id), categoryId: x.categoryId || '', name: String(x.name), icon: typeof x.icon === 'string' && x.icon.startsWith('data:image/') ? x.icon : '',
    plan: x.plan || '', cycle: CYCLES[x.cycle] ? x.cycle : 'month', currency: CURRENCIES[x.currency] ? x.currency : 'CNY', amount: Number(x.amount) || 0,
    lastPaid: isISO(x.lastPaid) ? x.lastPaid : '', nextDue: isISO(x.nextDue) ? x.nextDue : '', lead: LEADS.includes(Number(x.lead)) ? Number(x.lead) : 3,
    autoRenew: !!x.autoRenew, paused: !!x.paused, note: x.note || '',
    history: Array.isArray(x.history) ? x.history.filter((h) => h && isISO(h.date)).map((h) => ({ id: h.id || uid(), date: h.date, amount: Number(h.amount) || 0, currency: CURRENCIES[h.currency] ? h.currency : 'CNY', plan: h.plan || '' })) : [],
    createdAt: x.createdAt || nowStamp(), updatedAt: x.updatedAt || nowStamp()
  };
}
let state = emptyState();
let storageKind = 'browser';
let storageApi = null;
let saveQueue = Promise.resolve();
const ui = { filter: 'all', visibleLimit: 60, shown: { monthly: 0, yearly: 0 } };

function browserRead() {
  try { return localStorage.getItem(STORE_KEY); } catch (e) { return null; }
}
function clientVersion(options) {
  const env = options && options.miniToolEnv;
  const build = Number(env && env.buildVersion) || 0;
  return Math.floor(build / 1000);
}
function readNativeState(value) {
  // A key that has never been written can come back as an empty string.
  if (value === null || value === undefined || value === '') return null;
  let raw = value;
  if (typeof raw === 'string') raw = JSON.parse(raw);
  if (raw === null || (raw && typeof raw === 'object' && !Array.isArray(raw) && !Object.keys(raw).length)) return null;
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.subs) || !Array.isArray(raw.categories)) {
    throw new Error('invalid stored state');
  }
  return normalize(raw);
}
async function initStorage() {
  const xhs = window.xhs;
  const api = xhs && xhs.miniTool;
  let options = xhs && xhs.launchOptions;
  if (!clientVersion(options) && api && typeof api.getLaunchOptions === 'function') {
    try { options = await api.getLaunchOptions(); } catch (e) { options = null; }
  }
  if (clientVersion(options) >= 9460 && api && typeof api.getStorage === 'function' && typeof api.setStorage === 'function') {
    storageKind = 'xhs';
    storageApi = api;
    let stored;
    try { stored = await api.getStorage({ key: STORE_KEY }); }
    catch (e) { throw new Error('小红书本地数据暂时读取失败，请稍后重试'); }
    const nativeData = stored && stored.data;
    let parsed;
    try { parsed = readNativeState(nativeData); }
    catch (e) { throw new Error('本地数据格式异常，请先不要清理小红书数据'); }
    if (parsed) {
      state = parsed;
      return;
    }
    state = emptyState();
    // A client upgrade can expose native storage after earlier browser-storage use.
    const legacy = browserRead();
    if (legacy) {
      try {
        state = normalize(JSON.parse(legacy));
        await api.setStorage({ key: STORE_KEY, data: JSON.stringify(state) });
      } catch (e) { throw new Error('旧版数据迁移失败，请稍后重试'); }
    }
    return;
  }
  const legacy = browserRead();
  if (legacy) {
    try { state = normalize(JSON.parse(legacy)); }
    catch (e) { state = emptyState(); }
  }
}
function save() {
  let serialized;
  try {
    serialized = JSON.stringify(state);
  } catch (e) {
    toast('保存失败：数据无法序列化', 'alert');
    return Promise.resolve(false);
  }
  if (new Blob([serialized]).size > 1024 * 1024) {
    toast('数据已超过小红书单项存储上限，请缩小或移除部分图标', 'alert');
    return Promise.resolve(false);
  }
  const pending = saveQueue.then(async () => {
    try {
      if (storageKind === 'xhs') await storageApi.setStorage({ key: STORE_KEY, data: serialized });
      else localStorage.setItem(STORE_KEY, serialized);
      return true;
    } catch (e) {
      toast('保存失败，请稍后重试或先导出备份', 'alert');
      return false;
    }
  });
  saveQueue = pending.then(() => undefined);
  return pending;
}

/* ================= derived ================= */
function describeDue(days, windowDays) {
  if (days < 0) return { status: 'overdue', label: '已过期 ' + -days + ' 天' };
  if (days === 0) return { status: 'soon', label: '今天到期' };
  if (days <= windowDays) return { status: 'soon', label: days + ' 天后到期' };
  return { status: 'active', label: '还有 ' + days + ' 天' };
}
function statusOf(s) {
  if (s.paused) return { status: 'paused', label: '已停订', days: Infinity };
  if (!s.nextDue) return { status: 'active', label: '未设到期日', days: Infinity };
  const days = daysBetween(todayISO(), s.nextDue);
  return Object.assign({}, describeDue(days, s.lead), { days });
}
// Share of the current billing period already used (0–1), or null when it can't be told.
function cycleOf(s) {
  if (s.paused || !s.lastPaid || !s.nextDue) return null;
  const total = daysBetween(s.lastPaid, s.nextDue);
  if (total <= 0) return null;
  const used = daysBetween(s.lastPaid, todayISO());
  return { total, used: Math.max(0, Math.min(total, used)), share: Math.max(0, Math.min(1, used / total)) };
}
function monthlyCNY(s) {
  if (s.paused) return 0;
  const rate = Number(state.settings.rates[s.currency]) || 0;
  const perMonth = s.cycle === 'week' ? s.amount * 52 / 12 : s.amount / CYCLES[s.cycle].months;
  return perMonth * rate;
}
function sortedCategories() {
  const cats = [...state.categories].sort((a, b) => a.order - b.order);
  if (state.subs.some((s) => !state.categories.find((c) => c.id === s.categoryId))) cats.push({ id: '', name: '未分类', order: 1e9 });
  return cats;
}
function subsIn(catId) {
  const known = new Set(state.categories.map((c) => c.id));
  return state.subs
    .filter((s) => (catId ? s.categoryId === catId : !known.has(s.categoryId)))
    .sort((a, b) => (a.paused - b.paused) || ((a.nextDue || '9999') < (b.nextDue || '9999') ? -1 : (a.nextDue || '9999') > (b.nextDue || '9999') ? 1 : a.name.localeCompare(b.name, 'zh')));
}
function findSub(id) { return state.subs.find((s) => s.id === id); }
function catName(id) { const c = state.categories.find((x) => x.id === id); return c ? c.name : '未分类'; }
function toneOf(name) { let h = 7; for (const ch of name) h = (h * 31 + ch.codePointAt(0)) >>> 0; return h % 6; }

/* ================= render: pieces ================= */
function appIcon(s, size) {
  const name = s.name || '?';
  const inner = s.icon ? `<img src="${s.icon}" alt="">` : esc(name.trim().charAt(0).toUpperCase());
  return `<span class="app-icon${s.icon ? '' : ' tone-' + toneOf(name)}" style="--s:${size}px" role="img" aria-label="${esc(name)} 图标">${inner}</span>`;
}
function badge(st) {
  const ic = { soon: 'clock', overdue: 'alert', paused: 'pause' }[st.status];
  return `<span class="badge badge-${st.status}">${ic ? icon(ic, 14) : ''}${esc(st.label)}</span>`;
}
function planLine(s) { return [s.plan, CYCLES[s.cycle].label].filter(Boolean).join(' · '); }
function bar(s, st, i = 0) {
  const c = cycleOf(s);
  const share = st.status === 'overdue' ? 1 : c ? c.share : 0;
  return `<div class="bar bar-${st.status}" style="--i:${i}" aria-hidden="true"><i style="width:${(share * 100).toFixed(1)}%"></i></div>`;
}

function card(s, i) {
  const st = statusOf(s);
  return `<article class="card glass stagger${s.paused ? ' is-paused' : ''}" style="--i:${i}" data-open="${s.id}" tabindex="0" role="button" aria-label="${esc(s.name)}，${esc(st.label)}">
    <div class="card-top">${appIcon(s, 52)}<div class="card-id"><p class="name">${esc(s.name)}</p><p class="plan">${esc(planLine(s))}</p></div>${badge(st)}</div>
    <div class="price"><span class="amount">${esc(money(s.currency, s.amount))}</span><span class="unit">/ ${unitOf(s.cycle)}</span></div>
    ${bar(s, st, i)}
    <div class="dates"><span>上次 <b>${fmtDate(s.lastPaid)}</b></span><span>${s.paused ? '到期后不再续费' : `下次 <b>${fmtDate(s.nextDue)}</b>`}</span></div>
  </article>`;
}
function row(s, i) {
  const st = statusOf(s);
  const sub = planLine(s) + (s.paused ? ' · 已停订' : s.nextDue ? ' · 下次 ' + fmtDate(s.nextDue) : '');
  return `<div class="row stagger${s.paused ? ' is-paused' : ''}" style="--i:${i}" data-open="${s.id}" tabindex="0" role="button" aria-label="${esc(s.name)}，${esc(st.label)}">
    ${appIcon(s, 40)}
    <div class="row-id"><p class="name">${esc(s.name)}</p><p class="plan">${esc(sub)}</p></div>
    <div class="row-right"><span class="row-amt"><span class="num">${esc(money(s.currency, s.amount))}</span><span class="unit">/ ${unitOf(s.cycle)}</span></span>${badge(st)}</div>
  </div>`;
}
function catHead(name, list, i) {
  const monthly = list.reduce((t, s) => t + monthlyCNY(s), 0);
  const active = list.filter((s) => !s.paused).length;
  return `<div class="cat-head" style="--i:${i}"><h2>${esc(name)}</h2><span class="cat-meta">${list.length} 项${active ? ` · 每月约 <span class="num">¥ ${fmtNum(Math.round(monthly))}</span>` : ''}</span></div>`;
}

/* ================= render: page ================= */
function render(opts = {}) {
  const app = $('#app');
  const now = new Date();
  const view = state.settings.view;
  if (ui.filter !== 'all' && !sortedCategories().some((c) => c.id === ui.filter)) ui.filter = 'all';
  const statuses = state.subs.map((s) => ({ s, st: statusOf(s) }));
  const count = (k) => statuses.filter((x) => x.st.status === k).length;
  const attention = statuses.filter((x) => x.st.status === 'soon' || x.st.status === 'overdue').sort((a, b) => a.st.days - b.st.days);
  const has = state.subs.length > 0;

  app.innerHTML = `
    <header class="top">
      <div class="top-title"><h1>续费手账</h1><p class="date">${now.getMonth() + 1}月${now.getDate()}日 ${WEEKDAYS[now.getDay()]}</p></div>
      <div class="top-actions">
        <button class="btn btn-primary" data-act="add" aria-label="添加会员">${icon('plus')}<span class="btn-label">添加会员</span></button>
        <div class="menu-wrap">
          <button class="btn icon-btn" data-act="menu" aria-label="更多" aria-haspopup="menu" aria-expanded="false">${icon('more')}</button>
          <div class="menu" role="menu" hidden>
            <button role="menuitem" data-act="cats">${icon('folder')}管理大类</button>
            <button role="menuitem" data-act="export">${icon('upload')}导出备份</button>
            <button role="menuitem" data-act="import">${icon('download')}导入备份</button>
            <hr>
            <button role="menuitem" data-act="settings">${icon('gear')}设置</button>
          </div>
        </div>
      </div>
    </header>
    ${storageKind === 'browser' && window.xhs ? '<p class="storage-warning">当前小红书版本仅能使用临时浏览器存储。请升级小红书，并定期保存备份图。</p>' : ''}
    ${has ? `<section class="hero glass">
      <div>
        <span class="hero-label">每月会员支出约</span>
        <div class="hero-num"><span class="cur">¥</span><span id="hero-monthly">${fmtNum(ui.shown.monthly)}</span></div>
        <span class="hero-sub">每年约 <span class="num">¥ <span id="hero-yearly">${fmtNum(ui.shown.yearly)}</span></span></span>
      </div>
      <div class="hero-stats">
        <span class="stat"><b>${count('active') + count('soon') + count('overdue')}</b>项在续</span>
        ${count('soon') ? `<span class="stat stat-soon"><b>${count('soon')}</b>即将到期</span>` : ''}
        ${count('overdue') ? `<span class="stat stat-overdue"><b>${count('overdue')}</b>已过期</span>` : ''}
      </div>
    </section>` : ''}
    ${attention.length ? `<div class="attention glass" role="status"><span class="attention-title">${icon('bell', 16)}需要留意</span>${attention.slice(0, 8).map((x) => `<button class="att-item ${x.st.status}" data-open="${x.s.id}">${appIcon(x.s, 28)}${esc(x.s.name)}<span class="tag">${esc(x.st.label)}</span></button>`).join('')}${attention.length > 8 ? `<span class="attention-more">另有 ${attention.length - 8} 项</span>` : ''}</div>` : ''}
    ${has ? `<div class="toolbar">
      <div class="filters" role="group" aria-label="按大类筛选">${chipsHTML()}</div>
      <div class="seg glass" role="radiogroup" aria-label="显示方式" data-value="${view}">
        <span class="seg-thumb" aria-hidden="true"></span>
        <button class="seg-opt" role="radio" data-view="card" aria-checked="${view === 'card'}">${icon('grid', 16)}卡片</button>
        <button class="seg-opt" role="radio" data-view="list" aria-checked="${view === 'list'}">${icon('list', 16)}清单</button>
      </div></div>` : ''}
    <main id="main"></main>`;
  renderMain(opts.animate !== false);
  if (has) {
    const monthly = state.subs.reduce((t, s) => t + monthlyCNY(s), 0);
    countUp($('#hero-monthly'), ui.shown.monthly, Math.round(monthly), (v) => { ui.shown.monthly = v; });
    countUp($('#hero-yearly'), ui.shown.yearly, Math.round(monthly * 12), (v) => { ui.shown.yearly = v; });
  }
}
function chipsHTML() {
  return [`<button class="chip" data-filter="all" aria-pressed="${ui.filter === 'all'}">全部 <span class="count">${state.subs.length}</span></button>`]
    .concat(sortedCategories().map((c) => { const n = subsIn(c.id).length; return n ? `<button class="chip" data-filter="${c.id}" aria-pressed="${ui.filter === c.id}">${esc(c.name)} <span class="count">${n}</span></button>` : ''; })).join('');
}
function renderMain(animate) {
  const main = $('#main');
  main.className = animate && !REDUCED.matches ? 'anim' : '';
  if (!state.subs.length) {
    main.innerHTML = `<div class="empty glass">
      <div class="empty-art">${icon('ticket', 40)}</div>
      <h2>还没有记录任何会员</h2>
      <p>记下会员的套餐、花费和到期日。打开小工具时，就能看到近期到期的项目。</p>
      <div class="actions"><button class="btn btn-primary" data-act="add">${icon('plus')}添加会员</button><button class="btn" data-act="demo">${icon('sparkle')}载入示例看看</button></div>
    </div>`;
    return;
  }
  const view = state.settings.view;
  let k = 0;
  const cats = sortedCategories().filter((c) => ui.filter === 'all' || c.id === ui.filter);
  let remaining = ui.visibleLimit;
  let total = 0;
  const sections = cats.map((c) => {
    const list = subsIn(c.id);
    total += list.length;
    if (!list.length || remaining <= 0) return '';
    const visible = list.slice(0, remaining);
    remaining -= visible.length;
    const head = catHead(c.name, list, k);
    const items = visible.map((s) => (view === 'card' ? card : row)(s, ++k)).join('');
    k += 1;
    return `<section class="group">${head}${view === 'card' ? `<div class="grid">${items}</div>` : `<div class="list glass">${items}</div>`}</section>`;
  }).join('');
  main.innerHTML = (sections || '<div class="empty glass"><p style="margin:0">这个大类下还没有会员。</p></div>') +
    (total > ui.visibleLimit ? `<button class="btn load-more" data-act="show-more">再看 60 项（还有 ${total - ui.visibleLimit} 项）</button>` : '');
}
function countUp(el, from, to, done) {
  if (!el) return;
  if (from === to || REDUCED.matches) { el.textContent = fmtNum(to); done(to); return; }
  const t0 = performance.now(), dur = 900;
  const step = (t) => {
    if (!el.isConnected) return;
    const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 4);
    const v = Math.round(from + (to - from) * e);
    el.textContent = fmtNum(v);
    if (k < 1) requestAnimationFrame(step); else done(to);
  };
  requestAnimationFrame(step);
}

/* ---------- menu ---------- */
function openMenu() {
  const m = $('.menu'), b = $('[data-act="menu"]');
  if (!m) return;
  m.classList.remove('closing'); m.hidden = false; b.setAttribute('aria-expanded', 'true');
}
function closeMenu() {
  const m = $('.menu'), b = $('[data-act="menu"]');
  if (!m || m.hidden || m.classList.contains('closing')) return;
  m.classList.add('closing'); b.setAttribute('aria-expanded', 'false');
  setTimeout(() => { m.hidden = true; m.classList.remove('closing'); }, 140);
}
const menuOpen = () => { const m = $('.menu'); return m && !m.hidden && !m.classList.contains('closing'); };

/* ================= sheets ================= */
const sheet = () => $('#sheet');
let sheetTimer = 0;
function openSheet(title, bodyHTML, footHTML, opts = {}) {
  const d = sheet();
  clearTimeout(sheetTimer);
  d.classList.remove('closing');
  const keep = opts.still && d.open ? d.querySelector('.sheet-body').scrollTop : 0;
  d.innerHTML = `<div class="sheet-grabber" aria-hidden="true"></div>
    <div class="sheet-head"><h2>${title}</h2><button class="btn btn-plain icon-btn" data-act="close" aria-label="关闭">${icon('close')}</button></div>
    <div class="sheet-body${opts.still ? ' still' : ''}">${bodyHTML}</div>${footHTML ? `<div class="sheet-foot">${footHTML}</div>` : ''}`;
  if (!d.open) d.showModal();
  d.querySelector('.sheet-body').scrollTop = keep;
}
function closeSheet() {
  const d = sheet();
  if (!d.open || d.classList.contains('closing')) return;
  d.classList.add('closing');
  sheetTimer = setTimeout(() => { d.classList.remove('closing'); d.close(); }, REDUCED.matches ? 0 : 230);
}
function field(label, inner, hint = '') {
  return `<label class="field"><span class="field-label">${label}</span><span class="field-box">${inner}</span>${hint ? `<span class="field-hint">${hint}</span>` : ''}</label>`;
}
function setPressed(selector, match) { $$(selector).forEach((b) => b.setAttribute('aria-pressed', String(match(b)))); }

/* ---------- detail ---------- */
function openDetail(id) {
  const s = findSub(id);
  if (!s) return;
  const st = statusOf(s);
  const c = cycleOf(s);
  const hist = [...s.history].sort((a, b) => (a.date < b.date ? 1 : -1));
  const foreign = !s.paused && (s.currency !== 'CNY' || s.cycle !== 'month');
  const body = `
    <div class="detail-hero">${appIcon(s, 64)}<div style="min-width:0"><p class="name">${esc(s.name)}</p><p class="plan">${esc(catName(s.categoryId))} · ${esc(planLine(s))}</p></div></div>
    <div>
      <div class="detail-price"><span class="amount">${esc(money(s.currency, s.amount))}</span><span class="unit">/ ${unitOf(s.cycle)}</span>${badge(st)}</div>
      ${s.paused ? '' : `${bar(s, st)}<div class="cycle-cap"><span>${st.status === 'overdue' ? `已超过到期日 ${-st.days} 天，记得续费或标记停订` : c ? `本期已过 ${c.used} 天` : ''}</span><span>${c && st.status !== 'overdue' ? `共 ${c.total} 天` : ''}</span></div>`}
    </div>
    <div class="tiles">
      <div class="tile"><span class="k">上次续费</span><span class="v">${fmtDate(s.lastPaid)}</span></div>
      <div class="tile"><span class="k">${s.paused ? '到期后' : '下次到期'}</span><span class="v">${s.paused ? '不再续费' : fmtDate(s.nextDue)}</span></div>
      <div class="tile"><span class="k">首页提示</span><span class="v">${s.lead === 0 ? '到期当天' : '提前 ' + s.lead + ' 天'}</span></div>
      <div class="tile"><span class="k">${foreign ? '折合每月' : '扣费方式'}</span><span class="v">${foreign ? '¥ ' + fmtNum(Math.round(monthlyCNY(s))) : s.autoRenew ? '自动续费' : '手动续费'}</span></div>
    </div>
    ${s.note ? `<p class="note">${esc(s.note)}</p>` : ''}
    <div class="detail-actions">
      ${s.paused ? '' : `<button class="btn btn-primary" data-act="renew" data-id="${s.id}">${icon('renew')}记一笔续费</button>`}
      <button class="btn" data-act="edit" data-id="${s.id}">${icon('edit')}编辑</button>
    </div>
    <div>
      <p class="section-title">续费记录</p>
      ${hist.length ? `<ul class="history">${hist.map((h) => `<li><span class="dot"></span><span><span class="date">${fmtDateFull(h.date)}</span> <span class="muted">${esc(h.plan)}</span></span><span class="num">${esc(money(h.currency, h.amount))}</span><button class="rm" data-act="rm-hist" data-id="${s.id}" data-hid="${h.id}" aria-label="删除这条记录">${icon('close', 16)}</button></li>`).join('')}</ul>` : '<p class="muted" style="margin:0 0 24px 4px;font-size:14px">还没有续费记录。</p>'}
    </div>
    <div class="danger-zone">
      <button class="btn btn-sm" data-act="toggle-pause" data-id="${s.id}">${icon(s.paused ? 'play' : 'pause', 16)}${s.paused ? '恢复续费' : '标记停订'}</button>
      <button class="btn btn-sm btn-danger" data-act="delete" data-id="${s.id}">${icon('trash', 16)}删除</button>
    </div>`;
  openSheet('会员详情', body, '');
}

/* ---------- add / edit ---------- */
let draft = null;
function openEdit(id) {
  const s = id ? findSub(id) : null;
  const today = todayISO();
  draft = s ? JSON.parse(JSON.stringify(s)) : {
    id: '', categoryId: ui.filter !== 'all' ? ui.filter : (sortedCategories()[0] || {}).id || '', name: '', icon: '', plan: '', cycle: 'month', currency: 'CNY', amount: '',
    lastPaid: today, nextDue: addCycle(today, 'month'), lead: state.settings.defaultLead, autoRenew: true, paused: false, note: '', history: []
  };
  draft.nextManual = s ? s.nextDue !== (s.lastPaid ? addCycle(s.lastPaid, s.cycle) : '') : false;
  renderEdit(!!s);
}
function nextHint() {
  const auto = draft.lastPaid ? addCycle(draft.lastPaid, draft.cycle) : '';
  return draft.nextManual && auto ? `已手动修改 · <button type="button" data-act="auto-next">按周期算：${fmtDate(auto)}</button>` : '按上次续费日期和周期自动计算';
}
function iconPickHTML() {
  return `${appIcon({ name: draft.name || '?', icon: draft.icon }, 60)}
    <button type="button" class="btn btn-sm" data-act="pick-icon">${icon('upload', 16)}${draft.icon ? '更换图标' : '上传图标'}</button>
    ${draft.icon ? '<button type="button" class="btn btn-sm btn-plain" data-act="clear-icon">移除</button>' : ''}`;
}
function renderEdit(isEdit, still = false) {
  const d = draft;
  const cats = [...state.categories].sort((a, b) => a.order - b.order);
  if (!cats.length && !d.categoryId) d.categoryId = '__new';
  const isNewCat = d.categoryId === '__new';
  const known = cats.some((c) => c.id === d.categoryId);
  const catOpts = cats.map((c) => `<option value="${c.id}"${c.id === d.categoryId ? ' selected' : ''}>${esc(c.name)}</option>`).join('') +
    `<option value=""${!known && !isNewCat ? ' selected' : ''}>未分类</option><option value="__new"${isNewCat ? ' selected' : ''}>+ 新建大类…</option>`;
  const body = `<form class="form" id="edit-form" novalidate>
    <div class="field"><span class="field-label">图标</span><div class="icon-pick" id="icon-pick">${iconPickHTML()}</div>
      <span class="field-hint">从相册选一张图片，会自动裁成正方形。</span></div>
    ${field('软件名称', `<input name="name" required maxlength="40" placeholder="例如 Claude" value="${esc(d.name)}" autocomplete="off">`)}
    ${field('大类', `<select name="categoryId">${catOpts}</select>${icon('down', 16)}`)}
    <label class="field" id="new-cat" ${isNewCat ? '' : 'hidden'}><span class="field-label">新大类名称</span><span class="field-box"><input name="newCat" placeholder="例如 AI 工具、影音娱乐" maxlength="20" value="${esc(d.newCat || '')}"></span></label>
    ${field('套餐', `<input name="plan" maxlength="40" placeholder="例如 Plus、Max 5x、黑胶 VIP" value="${esc(d.plan)}" autocomplete="off">`)}
    <div class="field"><span class="field-label">付费周期</span><div class="choice-row">${Object.entries(CYCLES).map(([k, v]) => `<button type="button" class="chip" data-cycle="${k}" aria-pressed="${d.cycle === k}">${v.label}</button>`).join('')}</div></div>
    <div class="form-row">
      ${field('币种', `<select name="currency">${Object.entries(CURRENCIES).map(([k, v]) => `<option value="${k}"${d.currency === k ? ' selected' : ''}>${v.sym} ${v.name}</option>`).join('')}</select>${icon('down', 16)}`)}
      ${field('金额', `<span class="affix" id="cur-sym">${esc(CURRENCIES[d.currency].sym)}</span><input name="amount" inputmode="decimal" placeholder="0" value="${esc(d.amount)}" autocomplete="off"><span class="affix" id="cyc-unit">/ ${unitOf(d.cycle)}</span>`)}
    </div>
    <div class="form-row">
      ${field('上次续费日期', `<input type="date" name="lastPaid" value="${esc(d.lastPaid)}">`)}
      ${field('下次到期', `<input type="date" name="nextDue" value="${esc(d.nextDue)}">`, `<span id="next-hint">${nextHint()}</span>`)}
    </div>
    <div class="field"><span class="field-label">首页到期提示</span><div class="choice-row">${LEADS.map((n) => `<button type="button" class="chip" data-lead="${n}" aria-pressed="${d.lead === n}">${n === 0 ? '当天' : '提前 ' + n + ' 天'}</button>`).join('')}</div>
      <span class="field-hint">打开小工具时，会在首页标出近期到期和已过期的会员；小红书内没有系统通知。</span></div>
    <label class="switch-row"><span>自动续费（到期自动扣款）</span><input type="checkbox" class="switch" name="autoRenew" ${d.autoRenew ? 'checked' : ''}></label>
    ${field('备注', `<textarea name="note" rows="2" maxlength="500" placeholder="例如 绑定招行信用卡、用的是美区 Apple ID">${esc(d.note)}</textarea>`)}
  </form>`;
  const foot = `${isEdit ? `<button class="btn btn-danger spacer" data-act="delete" data-id="${d.id}">删除</button>` : '<span class="spacer"></span>'}
    <button class="btn" data-act="${isEdit ? 'back-detail' : 'close'}" data-id="${d.id}">取消</button>
    <button class="btn btn-primary" data-act="save-edit">${icon('check')}保存</button>`;
  openSheet(isEdit ? '编辑会员' : '添加会员', body, foot, { still });
}
function readDraftFromForm() {
  const f = $('#edit-form');
  if (!f) return;
  const fd = new FormData(f);
  draft.categoryId = fd.get('categoryId');
  draft.newCat = (fd.get('newCat') || '').trim();
  draft.name = (fd.get('name') || '').trim();
  draft.plan = (fd.get('plan') || '').trim();
  draft.currency = fd.get('currency');
  draft.amount = (fd.get('amount') || '').trim();
  draft.lastPaid = fd.get('lastPaid') || '';
  draft.nextDue = fd.get('nextDue') || '';
  draft.autoRenew = !!fd.get('autoRenew');
  draft.note = (fd.get('note') || '').trim();
}
function updateNextAuto() {
  if (!draft.nextManual && draft.lastPaid) {
    draft.nextDue = addCycle(draft.lastPaid, draft.cycle);
    const inp = $('#edit-form [name="nextDue"]');
    if (inp) inp.value = draft.nextDue;
  }
  const h = $('#next-hint');
  if (h) h.innerHTML = nextHint();
}
async function saveEdit() {
  readDraftFromForm();
  const amount = parseFloat(String(draft.amount).replace(/,/g, ''));
  if (!draft.name) { toast('请填写软件名称', 'alert'); $('#edit-form [name="name"]').focus(); return; }
  if (!Number.isFinite(amount) || amount < 0) { toast('请填写正确的金额', 'alert'); $('#edit-form [name="amount"]').focus(); return; }
  let categoryId = draft.categoryId;
  if (categoryId === '__new') {
    if (!draft.newCat) { toast('请填写新大类的名称', 'alert'); $('#edit-form [name="newCat"]').focus(); return; }
    const exist = state.categories.find((c) => c.name === draft.newCat);
    if (exist) categoryId = exist.id;
    else {
      categoryId = uid();
      state.categories.push({ id: categoryId, name: draft.newCat, order: state.categories.length, updatedAt: nowStamp() });
    }
  }
  const isNew = !draft.id;
  const existing = isNew ? null : findSub(draft.id);
  const sub = normalizeSub(Object.assign({}, existing || {}, draft, { id: draft.id || uid(), categoryId, amount, updatedAt: nowStamp(), createdAt: existing ? existing.createdAt : nowStamp() }));
  if (isNew && sub.lastPaid) sub.history = [{ id: uid(), date: sub.lastPaid, amount: sub.amount, currency: sub.currency, plan: sub.plan }];
  if (isNew) state.subs.push(sub); else state.subs[state.subs.findIndex((s) => s.id === sub.id)] = sub;
  if (!await save()) return;
  render();
  toast(isNew ? '已添加 ' + sub.name : '已保存');
  if (isNew) closeSheet(); else openDetail(sub.id);
}

/* ---------- icon upload ---------- */
function pickIcon() {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'image/*';
  inp.style.display = 'none';
  document.body.appendChild(inp);
  inp.onchange = async () => {
    const file = inp.files && inp.files[0];
    inp.remove();
    if (!file) return;
    try {
      draft.icon = await fileToIcon(file);
      $('#icon-pick').innerHTML = iconPickHTML();
    } catch (e) { toast('这张图片读不出来，换一张试试', 'alert'); }
  };
  inp.click();
}
function fileToIcon(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const S = 128;
      const c = document.createElement('canvas');
      c.width = c.height = S;
      const ctx = c.getContext('2d');
      const w = img.naturalWidth || S, h = img.naturalHeight || S, side = Math.min(w, h);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, (w - side) / 2, (h - side) / 2, side, side, 0, 0, S, S);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/png'));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')); };
    img.src = url;
  });
}

/* ---------- renew ---------- */
function openRenew(id) {
  const s = findSub(id);
  if (!s) return;
  const body = `<form class="form" id="renew-form" data-id="${s.id}" novalidate>
    <div class="detail-hero">${appIcon(s, 48)}<div style="min-width:0"><p class="name">${esc(s.name)}</p><p class="plan">当前 ${esc(planLine(s))} · ${esc(money(s.currency, s.amount))}</p></div></div>
    ${field('续费日期', `<input type="date" name="date" value="${todayISO()}">`)}
    ${field('套餐', `<input name="plan" maxlength="40" value="${esc(s.plan)}" autocomplete="off">`, '换了套餐就在这里改，会同步更新到卡片上')}
    <div class="form-row">
      ${field('币种', `<select name="currency">${Object.entries(CURRENCIES).map(([k, v]) => `<option value="${k}"${s.currency === k ? ' selected' : ''}>${v.sym} ${v.name}</option>`).join('')}</select>${icon('down', 16)}`)}
      ${field('金额', `<input name="amount" inputmode="decimal" value="${esc(s.amount)}" autocomplete="off">`)}
    </div>
    <p class="field-hint" id="renew-next" style="margin:0 0 0 4px"></p>
  </form>`;
  const foot = `<span class="spacer"></span><button class="btn" data-act="back-detail" data-id="${s.id}">取消</button><button class="btn btn-primary" data-act="save-renew" data-id="${s.id}">${icon('check')}记下这笔</button>`;
  openSheet('记一笔续费', body, foot);
  updateRenewHint();
}
function renewNextDue(s, date) {
  // Paid close to the due date: keep the billing anchor; otherwise count from the payment date.
  const near = s.cycle === 'week' ? 3 : 10;
  if (s.nextDue && Math.abs(daysBetween(s.nextDue, date)) <= near) return addCycle(s.nextDue, s.cycle);
  return addCycle(date, s.cycle);
}
function updateRenewHint() {
  const f = $('#renew-form');
  if (!f) return;
  const s = findSub(f.dataset.id);
  const date = f.date.value;
  $('#renew-next').textContent = isISO(date) ? '下次到期会更新为 ' + fmtDateFull(renewNextDue(s, date)) + '。' : '';
}
async function saveRenew(id) {
  const f = $('#renew-form');
  const s = findSub(id);
  const date = f.date.value;
  const amount = parseFloat(String(f.amount.value).replace(/,/g, ''));
  if (!isISO(date)) { toast('请选择续费日期', 'alert'); return; }
  if (!Number.isFinite(amount) || amount < 0) { toast('请填写正确的金额', 'alert'); return; }
  const plan = f.plan.value.trim();
  const currency = f.currency.value;
  s.history.push({ id: uid(), date, amount, currency, plan });
  if (!s.lastPaid || date >= s.lastPaid) {
    s.nextDue = renewNextDue(s, date);
    s.lastPaid = date;
    s.plan = plan;
    s.amount = amount;
    s.currency = currency;
  }
  s.updatedAt = nowStamp();
  if (!await save()) return;
  render();
  openDetail(id);
  toast('已记下，下次到期 ' + fmtDate(s.nextDue));
}

/* ---------- categories ---------- */
function openCats(still = false) {
  const cats = [...state.categories].sort((a, b) => a.order - b.order);
  const body = `<div class="cat-list">${cats.map((c, i) => {
    const n = state.subs.filter((s) => s.categoryId === c.id).length;
    return `<div class="cat-item">
      <span class="field-box"><input data-cat-name="${c.id}" value="${esc(c.name)}" maxlength="20" aria-label="大类名称"></span>
      <span class="count">${n} 项</span>
      <span style="display:flex"><button class="btn btn-plain icon-btn" data-act="cat-up" data-id="${c.id}" aria-label="上移" ${i === 0 ? 'disabled' : ''}>${icon('up')}</button><button class="btn btn-plain icon-btn" data-act="cat-down" data-id="${c.id}" aria-label="下移" ${i === cats.length - 1 ? 'disabled' : ''}>${icon('down')}</button></span>
      <button class="btn btn-plain icon-btn btn-danger" data-act="cat-del" data-id="${c.id}" aria-label="删除大类">${icon('trash')}</button>
    </div>`;
  }).join('') || '<p class="muted" style="margin:0">还没有大类。</p>'}</div>
  <form id="cat-add" class="form-row" style="grid-template-columns:1fr auto;align-items:end">
    ${field('新建大类', '<input name="name" placeholder="例如 AI 工具、云存储、学习" maxlength="20">')}
    <button class="btn" type="submit" style="height:46px">${icon('plus')}添加</button>
  </form>
  <p class="field-hint" style="margin:12px 0 0 4px">改名后点输入框外面就会保存。删除大类时，里面的会员会移到「未分类」。</p>`;
  openSheet('管理大类', body, '', { still });
}
async function moveCat(id, dir) {
  const cats = [...state.categories].sort((a, b) => a.order - b.order);
  const i = cats.findIndex((c) => c.id === id), j = i + dir;
  if (j < 0 || j >= cats.length) return;
  [cats[i], cats[j]] = [cats[j], cats[i]];
  cats.forEach((c, k) => { c.order = k; c.updatedAt = nowStamp(); });
  if (await save()) { render({ animate: false }); openCats(true); }
}

/* ---------- settings ---------- */
function openSettings() {
  const st = state.settings;
  const body = `<div class="field"><span class="field-label">汇率（1 单位外币 = 多少人民币），用于估算每月花费</span>
      <div class="rates">${Object.entries(CURRENCIES).filter(([k]) => k !== 'CNY').map(([k, v]) => field(`${v.name} ${v.sym}`, `<input data-rate="${k}" inputmode="decimal" value="${esc(st.rates[k])}">`)).join('')}</div>
    </div>
    <div class="field" style="margin-top:18px"><span class="field-label">新会员默认提前几天在首页提示</span><div class="choice-row">${LEADS.map((n) => `<button type="button" class="chip" data-deflead="${n}" aria-pressed="${st.defaultLead === n}">${n === 0 ? '当天' : '提前 ' + n + ' 天'}</button>`).join('')}</div></div>
    <div class="field" style="margin-top:18px"><span class="field-label">数据</span>
      <span class="field-hint">数据只保存在当前小红书小工具中。换设备或清理数据前，请先将备份图保存到相册。</span>
      <div class="choice-row" style="margin-top:6px"><button class="btn btn-sm" data-act="export">${icon('upload', 16)}导出备份</button><button class="btn btn-sm" data-act="import">${icon('download', 16)}导入备份</button><button class="btn btn-sm btn-danger" data-act="wipe">${icon('trash', 16)}清空全部数据</button></div>
    </div>`;
  openSheet('设置', body, '');
}

/* ================= backup images: see backup.js ================= */
function mergeState(incoming) {
  const tomb = new Map();
  [...state.deleted, ...incoming.deleted].forEach((d) => { if (!tomb.has(d.id) || tomb.get(d.id) < d.at) tomb.set(d.id, d.at); });
  const pick = (a, b) => (!a ? b : !b ? a : (a.updatedAt || '') >= (b.updatedAt || '') ? a : b);
  const byId = (arr) => new Map(arr.map((x) => [x.id, x]));
  const merge = (mine, theirs) => {
    const A = byId(mine), B = byId(theirs), out = [];
    new Set([...A.keys(), ...B.keys()]).forEach((id) => {
      const win = pick(A.get(id), B.get(id));
      if (tomb.has(id) && tomb.get(id) >= (win.updatedAt || '')) return;
      out.push(win);
    });
    return out;
  };
  state.subs = merge(state.subs, incoming.subs);
  state.categories = merge(state.categories, incoming.categories);
  state.deleted = [...tomb].map(([id, at]) => ({ id, at }));
}

/* ================= demo data ================= */
async function loadDemo() {
  const t = todayISO();
  const cat = (name, order) => ({ id: uid(), name, order, updatedAt: nowStamp() });
  const ai = cat('AI 工具', 0), media = cat('影音娱乐', 1), cloud = cat('云存储', 2);
  const mk = (o) => {
    const s = normalizeSub(Object.assign({ id: uid(), lead: 3, autoRenew: true }, o));
    s.history = [{ id: uid(), date: s.lastPaid, amount: s.amount, currency: s.currency, plan: s.plan }];
    return s;
  };
  const back = (cycle, daysAhead) => { const next = addDays(t, daysAhead); return { nextDue: next, lastPaid: addCycle(next, cycle, -1) }; };
  state.categories.push(ai, media, cloud);
  state.subs.push(
    mk(Object.assign({ categoryId: ai.id, name: 'Claude', plan: 'Max 5x', cycle: 'month', currency: 'USD', amount: 100, lead: 7 }, back('month', 5))),
    mk(Object.assign({ categoryId: ai.id, name: 'ChatGPT', plan: 'Plus', cycle: 'month', currency: 'USD', amount: 20 }, back('month', 17))),
    mk(Object.assign({ categoryId: media.id, name: '网易云音乐', plan: '黑胶 VIP', cycle: 'year', currency: 'CNY', amount: 158, autoRenew: false }, back('year', -5))),
    mk(Object.assign({ categoryId: media.id, name: '爱奇艺', plan: '黄金会员', cycle: 'month', currency: 'CNY', amount: 25, paused: true }, back('month', 12))),
    mk(Object.assign({ categoryId: cloud.id, name: 'iCloud+', plan: '200GB', cycle: 'month', currency: 'CNY', amount: 21 }, back('month', 12)))
  );
  if (await save()) { render(); toast('已载入示例，可以随时删掉', 'sparkle'); }
}

/* ================= toast ================= */
function toast(msg, ic = 'check') {
  const el = $('#toast');
  clearTimeout(toast.t); clearTimeout(toast.t2);
  el.classList.remove('leaving');
  el.hidden = true; void el.offsetWidth;
  el.innerHTML = icon(ic, 18) + '<span></span>';
  el.lastChild.textContent = msg;
  el.hidden = false;
  toast.t = setTimeout(() => { el.classList.add('leaving'); toast.t2 = setTimeout(() => { el.hidden = true; el.classList.remove('leaving'); }, 250); }, 2600);
}

/* ================= events ================= */
document.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-act],[data-open],[data-filter],[data-view],[data-cycle],[data-lead],[data-deflead]');
  if (menuOpen() && !(t && t.dataset.act === 'menu')) closeMenu();
  if (!t) return;
  const d = t.dataset;

  if (d.open) { openDetail(d.open); return; }
  if (d.filter) {
    if (ui.filter === d.filter) return;
    ui.filter = d.filter;
    ui.visibleLimit = 60;
    setPressed('[data-filter]', (b) => b.dataset.filter === ui.filter);
    renderMain(true);
    return;
  }
  if (d.view) {
    if (state.settings.view === d.view) return;
    state.settings.view = d.view;
    if (!await save()) return;
    const seg = t.closest('.seg');
    seg.dataset.value = d.view;
    $$('.seg-opt', seg).forEach((b) => b.setAttribute('aria-checked', String(b.dataset.view === d.view)));
    renderMain(true);
    return;
  }
  if (d.cycle) {
    readDraftFromForm(); draft.cycle = d.cycle;
    setPressed('[data-cycle]', (b) => b.dataset.cycle === d.cycle);
    $('#cyc-unit').textContent = '/ ' + unitOf(d.cycle);
    updateNextAuto();
    return;
  }
  if (d.lead) { draft.lead = Number(d.lead); setPressed('[data-lead]', (b) => b.dataset.lead === d.lead); return; }
  if (d.deflead) { state.settings.defaultLead = Number(d.deflead); if (await save()) setPressed('[data-deflead]', (b) => b.dataset.deflead === d.deflead); return; }

  e.preventDefault();
  const s = d.id ? findSub(d.id) : null;
  switch (d.act) {
    case 'show-more': ui.visibleLimit += 60; renderMain(false); break;
    case 'retry-load':
      try { await initStorage(); render(); }
      catch (error) { toast(error.message || '读取失败，请重试', 'alert'); }
      break;
    case 'menu': menuOpen() ? closeMenu() : openMenu(); break;
    case 'close': closeSheet(); break;
    case 'add': openEdit(null); break;
    case 'demo': await loadDemo(); break;
    case 'edit': openEdit(d.id); break;
    case 'back-detail': d.id ? openDetail(d.id) : closeSheet(); break;
    case 'save-edit': await saveEdit(); break;
    case 'pick-icon': readDraftFromForm(); pickIcon(); break;
    case 'clear-icon': draft.icon = ''; $('#icon-pick').innerHTML = iconPickHTML(); break;
    case 'auto-next': readDraftFromForm(); draft.nextManual = false; updateNextAuto(); break;
    case 'renew': openRenew(d.id); break;
    case 'save-renew': await saveRenew(d.id); break;
    case 'rm-hist':
      if (s && confirm('删除这条续费记录？')) { s.history = s.history.filter((h) => h.id !== d.hid); s.updatedAt = nowStamp(); if (await save()) openDetail(s.id); }
      break;
    case 'toggle-pause':
      if (s) { s.paused = !s.paused; s.updatedAt = nowStamp(); if (await save()) { render({ animate: false }); openDetail(s.id); toast(s.paused ? '已标记停订' : '已恢复续费', s.paused ? 'pause' : 'play'); } }
      break;
    case 'delete':
      if (s && confirm(`删除「${s.name}」和它的全部续费记录？`)) {
        state.subs = state.subs.filter((x) => x.id !== s.id);
        state.deleted.push({ id: s.id, at: nowStamp() });
        if (await save()) { render(); closeSheet(); toast('已删除 ' + s.name, 'trash'); }
      }
      break;
    case 'cats': openCats(); break;
    case 'cat-up': await moveCat(d.id, -1); break;
    case 'cat-down': await moveCat(d.id, 1); break;
    case 'cat-del': {
      const c = state.categories.find((x) => x.id === d.id);
      const n = state.subs.filter((x) => x.categoryId === d.id).length;
      if (c && confirm(n ? `删除大类「${c.name}」？里面的 ${n} 个会员会移到「未分类」。` : `删除大类「${c.name}」？`)) {
        state.categories = state.categories.filter((x) => x.id !== c.id);
        state.deleted.push({ id: c.id, at: nowStamp() });
        if (await save()) { render({ animate: false }); openCats(true); }
      }
      break;
    }
    case 'settings': openSettings(); break;
    case 'export': await exportBackup(); break;
    case 'import': importBackup(); break;
    case 'import-image': importBackupImage(); break;
    case 'import-text': importBackupText(); break;
    case 'import-merge': if (importBackup.pending) { mergeState(importBackup.pending); if (await save()) { render(); closeSheet(); toast('已合并备份'); } } break;
    case 'import-replace':
      if (importBackup.pending && confirm('确定用备份覆盖这台设备上的全部数据？')) { state = importBackup.pending; if (await save()) { render(); closeSheet(); toast('已导入备份'); } }
      break;
    case 'wipe':
      if (confirm('清空这台设备上的全部会员和大类？此操作不能撤销，建议先导出备份。') && confirm('再确认一次：真的清空吗？')) {
        const settings = state.settings; state = emptyState(); state.settings = settings; ui.shown = { monthly: 0, yearly: 0 }; if (await save()) { render(); closeSheet(); toast('已清空', 'trash'); }
      }
      break;
  }
});

document.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-open][role="button"]')) { e.preventDefault(); openDetail(e.target.dataset.open); }
  if (e.key === 'Escape' && menuOpen()) closeMenu();
});

document.addEventListener('change', async (e) => {
  const t = e.target;
  if (t.closest('#edit-form')) {
    if (t.name === 'categoryId') { $('#new-cat').hidden = t.value !== '__new'; if (t.value === '__new') $('#edit-form [name="newCat"]').focus(); }
    if (t.name === 'currency') $('#cur-sym').textContent = CURRENCIES[t.value].sym;
    if (t.name === 'lastPaid') { readDraftFromForm(); updateNextAuto(); }
    if (t.name === 'nextDue') {
      readDraftFromForm();
      const auto = draft.lastPaid ? addCycle(draft.lastPaid, draft.cycle) : '';
      draft.nextManual = !!draft.nextDue && draft.nextDue !== auto;
      $('#next-hint').innerHTML = nextHint();
    }
  }
  if (t.closest('#renew-form')) updateRenewHint();
  if (t.dataset.catName) {
    const c = state.categories.find((x) => x.id === t.dataset.catName);
    const v = t.value.trim();
    if (c && v && v !== c.name) { c.name = v; c.updatedAt = nowStamp(); if (await save()) { render({ animate: false }); toast('已改名为 ' + v); } }
    else if (c && !v) t.value = c.name;
  }
  if (t.dataset.rate) {
    const v = parseFloat(t.value);
    if (Number.isFinite(v) && v > 0) { state.settings.rates[t.dataset.rate] = v; if (await save()) render({ animate: false }); }
    else t.value = state.settings.rates[t.dataset.rate];
  }
});

document.addEventListener('input', (e) => {
  if (e.target.closest('#edit-form') && e.target.name === 'name' && draft && !draft.icon) {
    // Swap the placeholder only when its letter changes, so it pops once rather than on every keystroke.
    const name = e.target.value || '?';
    const i = $('#icon-pick .app-icon');
    if (i && i.textContent !== name.trim().charAt(0).toUpperCase()) i.outerHTML = appIcon({ name }, 60);
  }
});

document.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (e.target.id === 'cat-add') {
    const name = e.target.name.value.trim();
    if (!name) return;
    if (state.categories.some((c) => c.name === name)) { toast('已经有这个大类了', 'alert'); return; }
    state.categories.push({ id: uid(), name, order: state.categories.length, updatedAt: nowStamp() });
    if (await save()) { render({ animate: false }); openCats(true); }
  }
  if (e.target.id === 'edit-form') await saveEdit();
});

document.addEventListener('DOMContentLoaded', async () => {
  if (!supportsFlexGap()) document.documentElement.classList.add('no-flex-gap');
  const d = sheet();
  // Tapping the dimmed backdrop, or pressing Esc, closes the sheet with its exit animation.
  d.addEventListener('click', (e) => {
    const r = d.getBoundingClientRect();
    if (e.target === d && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) closeSheet();
  });
  d.addEventListener('cancel', (e) => { e.preventDefault(); closeSheet(); });
  try { await initStorage(); }
  catch (error) {
    $('#app').innerHTML = `<div class="empty glass"><h2>暂时读不到记录</h2><p>${esc(error.message)}</p><button class="btn btn-primary" data-act="retry-load">重试读取</button></div>`;
    return;
  }
  render();
  // Refresh the day counts when the app comes back to the foreground.
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !sheet().open) render({ animate: false }); });
});
