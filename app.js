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

/* ================= utilities ================= */
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const pad = (n) => String(n).padStart(2, '0');
const nowStamp = () => new Date().toISOString();

function parseD(iso) { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); }
function toISO(dt) { return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate()); }
function todayISO() { return toISO(new Date()); }
function isISO(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }
function daysBetween(a, b) { return Math.round((parseD(b) - parseD(a)) / 86400000); }
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

/* ================= icons (SF Symbols stand-ins, 24px / 1.75 stroke) ================= */
const GLYPHS = {
  grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
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
  ticket: '<path d="M3.75 7.5A1.5 1.5 0 0 1 5.25 6h13.5a1.5 1.5 0 0 1 1.5 1.5v2.25a2.25 2.25 0 0 0 0 4.5v2.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-2.25a2.25 2.25 0 0 0 0-4.5z"/><path d="M15 6.5v1.5M15 11.25v1.5M15 16v1.5"/>'
};
function icon(name, size = 18) {
  return `<svg class="rn-ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${GLYPHS[name] || ''}</svg>`;
}

/* ================= state ================= */
function emptyState() {
  return { version: 1, categories: [], subs: [], deleted: [], settings: { rates: { ...DEFAULT_RATES }, soonWindow: 7, defaultLead: 3, view: 'card' } };
}
function normalize(raw) {
  const s = emptyState();
  if (!raw || typeof raw !== 'object') return s;
  if (Array.isArray(raw.categories)) s.categories = raw.categories.filter((c) => c && c.id && c.name).map((c, i) => ({ id: String(c.id), name: String(c.name), order: Number.isFinite(c.order) ? c.order : i, updatedAt: c.updatedAt || nowStamp() }));
  if (Array.isArray(raw.subs)) s.subs = raw.subs.filter((x) => x && x.id && x.name).map(normalizeSub);
  if (Array.isArray(raw.deleted)) s.deleted = raw.deleted.filter((d) => d && d.id);
  if (raw.settings) {
    Object.assign(s.settings, raw.settings);
    s.settings.rates = { ...DEFAULT_RATES, ...(raw.settings.rates || {}) };
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
function load() {
  try { return normalize(JSON.parse(localStorage.getItem(STORE_KEY))); } catch (e) { return emptyState(); }
}
let state = load();
const ui = { filter: 'all', menuOpen: false };

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch (e) {
    toast('保存失败：浏览器存储空间不足，试试删掉几个大图标');
    return false;
  }
  if (navigator.storage && navigator.storage.persist && !save.asked) { save.asked = true; navigator.storage.persist().catch(() => {}); }
  return true;
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
  return { ...describeDue(days, Math.max(state.settings.soonWindow, s.lead)), days };
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

/* ================= render: pieces ================= */
function appIcon(s, size) {
  const initial = (s.name || '?').trim().charAt(0).toUpperCase();
  return `<span class="rn-appicon" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.42)}px" role="img" aria-label="${esc(s.name)} 图标">${s.icon ? `<img src="${s.icon}" alt="">` : esc(initial)}</span>`;
}
function badge(st) {
  const ic = { soon: 'clock', overdue: 'alert', paused: 'pause' }[st.status];
  return `<span class="rn-badge rn-badge-${st.status}">${ic ? icon(ic, 14) : ''}${esc(st.label)}</span>`;
}
function planLine(s) { return [s.plan, CYCLES[s.cycle].label].filter(Boolean).join(' · '); }

function card(s) {
  const st = statusOf(s);
  return `<article class="rn-card${s.paused ? ' is-paused' : ''}" data-open="${s.id}" tabindex="0" role="button" aria-label="${esc(s.name)}，${esc(st.label)}">
    <div class="rn-card-top">${appIcon(s, 48)}<div class="rn-card-id"><p class="rn-name">${esc(s.name)}</p><p class="rn-plan">${esc(planLine(s))}</p></div>${badge(st)}</div>
    <div class="rn-card-price"><span class="rn-amount">${esc(money(s.currency, s.amount))}</span><span class="rn-unit">/ ${unitOf(s.cycle)}</span></div>
    <div class="rn-perf" aria-hidden="true"></div>
    <div class="rn-card-stub">
      <div><span class="rn-k">上次续费</span><span class="rn-v">${fmtDate(s.lastPaid)}</span></div>
      <div><span class="rn-k">${s.paused ? '到期后' : '下次到期'}</span><span class="rn-v">${s.paused ? '不再续费' : fmtDate(s.nextDue)}</span></div>
    </div>
  </article>`;
}
function row(s) {
  const st = statusOf(s);
  const sub = planLine(s) + (s.lastPaid ? ' · 上次 ' + fmtDate(s.lastPaid) : '');
  return `<div class="rn-rowitem${s.paused ? ' is-paused' : ''}" data-open="${s.id}" tabindex="0" role="button" aria-label="${esc(s.name)}，${esc(st.label)}">
    ${appIcon(s, 32)}
    <div class="rn-row-id"><p class="rn-name">${esc(s.name)}</p><p class="rn-plan">${esc(sub)}</p></div>
    <div class="rn-row-due">${badge(st)}<span class="rn-row-date">${s.paused ? '到期后不再续费' : s.nextDue ? fmtDate(s.nextDue) + ' 到期' : ''}</span></div>
    <div class="rn-row-amt"><span><span class="rn-num">${esc(money(s.currency, s.amount))}</span><span class="rn-unit">/ ${unitOf(s.cycle)}</span></span>${badge(st)}</div>
  </div>`;
}
function categoryHeader(name, list) {
  const monthly = list.reduce((t, s) => t + monthlyCNY(s), 0);
  const active = list.filter((s) => !s.paused).length;
  return `<div class="rn-cat"><h2>${esc(name)}</h2><span class="rn-cat-meta">${list.length} 项${active ? ` · 每月约 <span class="rn-num">¥ ${fmtNum(Math.round(monthly))}</span>` : ''}</span></div>`;
}

/* ================= render: page ================= */
function render() {
  const app = $('#app');
  const total = state.subs.reduce((t, s) => t + monthlyCNY(s), 0);
  const activeCount = state.subs.filter((s) => !s.paused).length;
  const view = state.settings.view;
  if (ui.filter !== 'all' && !sortedCategories().some((c) => c.id === ui.filter)) ui.filter = 'all';

  const attention = state.subs.map((s) => ({ s, st: statusOf(s) })).filter((x) => x.st.status === 'soon' || x.st.status === 'overdue').sort((a, b) => a.st.days - b.st.days);

  let body = '';
  if (!state.subs.length) {
    body = `<div class="empty">
      <div class="empty-art">${icon('ticket', 48)}</div>
      <h2>还没有记录任何会员</h2>
      <p>把 Claude、ChatGPT 这些会员记下来：什么套餐、上次什么时候续的、花了多少，到期前会提醒你。</p>
      <div class="actions"><button class="rn-btn rn-btn-primary" data-act="add">${icon('plus')}添加会员</button><button class="rn-btn" data-act="demo">载入示例看看</button></div>
    </div>`;
  } else {
    const cats = sortedCategories().filter((c) => ui.filter === 'all' || c.id === ui.filter);
    body = cats.map((c) => {
      const list = subsIn(c.id);
      if (!list.length) return '';
      return `<section class="group">${categoryHeader(c.name, list)}${view === 'card' ? `<div class="rn-grid">${list.map(card).join('')}</div>` : `<div class="rn-list">${list.map(row).join('')}</div>`}</section>`;
    }).join('') || '<div class="empty"><p>这个大类下还没有会员。</p></div>';
  }

  const chips = state.subs.length ? [`<button class="rn-chip" data-filter="all" aria-pressed="${ui.filter === 'all'}">全部 <span class="count">${state.subs.length}</span></button>`]
    .concat(sortedCategories().map((c) => { const n = subsIn(c.id).length; return n ? `<button class="rn-chip" data-filter="${c.id}" aria-pressed="${ui.filter === c.id}">${esc(c.name)} <span class="count">${n}</span></button>` : ''; })).join('') : '';

  app.innerHTML = `
    <header class="topbar">
      <h1>续费簿</h1>
      <div class="topbar-actions">
        <button class="rn-btn rn-btn-primary" data-act="add" aria-label="添加会员">${icon('plus')}<span class="btn-label">添加会员</span></button>
        <div class="menu-wrap">
          <button class="rn-btn rn-btn-icon" data-act="menu" aria-label="更多" aria-haspopup="menu" aria-expanded="${ui.menuOpen}">${icon('more')}</button>
          ${ui.menuOpen ? `<div class="menu" role="menu">
            <button role="menuitem" data-act="cats">${icon('folder')}管理大类</button>
            <button role="menuitem" data-act="ics-all">${icon('calendar')}全部加到日历</button>
            <hr>
            <button role="menuitem" data-act="export">${icon('upload')}导出备份</button>
            <button role="menuitem" data-act="import">${icon('download')}导入备份</button>
            <hr>
            <button role="menuitem" data-act="settings">${icon('gear')}设置</button>
          </div>` : ''}
        </div>
      </div>
    </header>
    ${state.subs.length ? `<p class="summary">${activeCount} 项在续 · 每月约 <span class="rn-num">¥ ${fmtNum(Math.round(total))}</span> · 每年约 <span class="rn-num">¥ ${fmtNum(Math.round(total * 12))}</span></p>` : ''}
    ${attention.length ? `<div class="alert" role="status">${icon('bell')}<div class="alert-body"><span class="alert-title">需要留意</span>${attention.map((x) => `<button class="alert-item" data-open="${x.s.id}">${appIcon(x.s, 20)}${esc(x.s.name)} · ${esc(x.st.label)}</button>`).join('')}</div></div>` : ''}
    ${state.subs.length ? `<div class="toolbar"><div class="filters" role="group" aria-label="按大类筛选">${chips}</div>
      <div class="rn-seg" role="radiogroup" aria-label="显示方式">
        <button class="rn-seg-opt" role="radio" data-view="card" aria-checked="${view === 'card'}">${icon('grid', 16)}卡片</button>
        <button class="rn-seg-opt" role="radio" data-view="list" aria-checked="${view === 'list'}">${icon('list', 16)}清单</button>
      </div></div>` : ''}
    <main>${body}</main>`;
}

/* ================= dialogs ================= */
const sheet = () => $('#sheet');
function openSheet(title, bodyHTML, footHTML, cls = '') {
  const d = sheet();
  d.className = 'sheet ' + cls;
  d.innerHTML = `<div class="sheet-head"><h2>${title}</h2><button class="rn-btn rn-btn-plain rn-btn-icon" data-act="close" aria-label="关闭">${icon('close')}</button></div>
    <div class="sheet-body">${bodyHTML}</div>${footHTML ? `<div class="sheet-foot">${footHTML}</div>` : ''}`;
  if (!d.open) d.showModal();
  d.querySelector('.sheet-body').scrollTop = 0;
}
function closeSheet() { const d = sheet(); if (d.open) d.close(); }

function field(label, inner, hint = '', attrs = '') {
  return `<label class="rn-field" ${attrs}><span class="rn-field-label">${label}</span><span class="rn-field-box">${inner}</span>${hint ? `<span class="rn-field-hint">${hint}</span>` : ''}</label>`;
}

/* ---------- detail ---------- */
function openDetail(id) {
  const s = findSub(id);
  if (!s) return;
  const st = statusOf(s);
  const eq = !s.paused && (s.currency !== 'CNY' || s.cycle !== 'month') ? `<span class="equiv">每月约 ¥ ${fmtNum(Math.round(monthlyCNY(s)))}</span>` : '';
  const hist = [...s.history].sort((a, b) => (a.date < b.date ? 1 : -1));
  const body = `<div class="detail">
    <div class="detail-top">${appIcon(s, 56)}<div class="rn-card-id"><p class="rn-name">${esc(s.name)}</p><p class="rn-plan">${esc(catName(s.categoryId))} · ${esc(planLine(s))}${s.autoRenew ? ' · 自动续费' : ''}</p></div>${badge(st)}</div>
    <div class="detail-price"><span class="rn-amount">${esc(money(s.currency, s.amount))}</span><span class="rn-unit">/ ${unitOf(s.cycle)}</span>${eq}</div>
    <div class="rn-perf" aria-hidden="true"></div>
    <div class="detail-stub">
      <div><span class="rn-k">上次续费</span><span class="rn-v">${fmtDate(s.lastPaid)}</span></div>
      <div><span class="rn-k">${s.paused ? '到期后' : '下次到期'}</span><span class="rn-v">${s.paused ? '不再续费' : fmtDate(s.nextDue)}</span></div>
      <div><span class="rn-k">提醒</span><span class="rn-v">${s.lead === 0 ? '到期当天' : '提前 ' + s.lead + ' 天'}</span></div>
    </div>
    ${s.note ? `<p class="detail-note">${esc(s.note)}</p>` : ''}
    <div class="detail-actions">
      ${s.paused ? '' : `<button class="rn-btn rn-btn-primary" data-act="renew" data-id="${s.id}">${icon('renew')}记一笔续费</button>`}
      ${s.paused || !s.nextDue ? '' : `<button class="rn-btn" data-act="ics" data-id="${s.id}">${icon('calendar')}加到日历</button>`}
      <button class="rn-btn" data-act="edit" data-id="${s.id}">${icon('edit')}编辑</button>
    </div>
    <p class="section-title">续费记录</p>
    ${hist.length ? `<ul class="history">${hist.map((h) => `<li><span class="date">${fmtDateFull(h.date)}</span><span class="plan">${esc(h.plan)}</span><span class="rn-num">${esc(money(h.currency, h.amount))}</span><button class="rm" data-act="rm-hist" data-id="${s.id}" data-hid="${h.id}" aria-label="删除这条记录">${icon('close', 16)}</button></li>`).join('')}</ul>` : '<p class="muted" style="margin:0 0 24px;font-size:14px">还没有续费记录。</p>'}
    <div class="danger-zone">
      <button class="rn-btn rn-btn-sm" data-act="toggle-pause" data-id="${s.id}">${icon(s.paused ? 'play' : 'pause', 16)}${s.paused ? '恢复续费' : '标记停订'}</button>
      <button class="rn-btn rn-btn-sm rn-btn-danger" data-act="delete" data-id="${s.id}">${icon('trash', 16)}删除</button>
    </div>
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
function renderEdit(isEdit) {
  const d = draft;
  const cats = [...state.categories].sort((a, b) => a.order - b.order);
  if (!cats.length && !d.categoryId) d.categoryId = '__new';
  const isNewCat = d.categoryId === '__new';
  const known = cats.some((c) => c.id === d.categoryId);
  const catOpts = cats.map((c) => `<option value="${c.id}"${c.id === d.categoryId ? ' selected' : ''}>${esc(c.name)}</option>`).join('') +
    `<option value=""${!known && !isNewCat ? ' selected' : ''}>未分类</option><option value="__new"${isNewCat ? ' selected' : ''}>+ 新建大类…</option>`;
  const auto = d.lastPaid ? addCycle(d.lastPaid, d.cycle) : '';
  const body = `<form class="form" id="edit-form" novalidate>
    ${field('大类', `<select name="categoryId">${catOpts}</select>${icon('down', 16)}`)}
    <label class="rn-field" id="new-cat" ${isNewCat ? '' : 'hidden'}><span class="rn-field-label">新大类名称</span><span class="rn-field-box"><input name="newCat" placeholder="例如 AI 工具、影音娱乐" maxlength="20" value="${esc(d.newCat || '')}"></span></label>
    ${field('软件名称', `<input name="name" required maxlength="40" placeholder="例如 Claude" value="${esc(d.name)}" autocomplete="off">`)}
    <div class="rn-field"><span class="rn-field-label">图标</span>
      <div class="icon-pick"><span id="icon-preview">${appIcon({ name: d.name || '?', icon: d.icon }, 56)}</span>
        <button type="button" class="rn-btn rn-btn-sm" data-act="pick-icon">${icon('upload', 16)}${d.icon ? '更换图标' : '上传图标'}</button>
        ${d.icon ? `<button type="button" class="rn-btn rn-btn-sm rn-btn-plain" data-act="clear-icon">移除</button>` : ''}
      </div>
      <span class="rn-field-hint">从相册或文件选一张图，会自动裁成正方形。可以在 App Store 页面截图后裁出图标。</span>
    </div>
    ${field('套餐', `<input name="plan" maxlength="40" placeholder="例如 Plus、Max 5x、黑胶 VIP" value="${esc(d.plan)}" autocomplete="off">`)}
    <div class="rn-field"><span class="rn-field-label">付费周期</span><div class="choice-row">${Object.entries(CYCLES).map(([k, v]) => `<button type="button" class="rn-chip" data-cycle="${k}" aria-pressed="${d.cycle === k}">${v.label}</button>`).join('')}</div></div>
    <div class="form-row">
      ${field('币种', `<select name="currency">${Object.entries(CURRENCIES).map(([k, v]) => `<option value="${k}"${d.currency === k ? ' selected' : ''}>${v.sym} ${v.name}</option>`).join('')}</select>${icon('down', 16)}`)}
      ${field('金额', `<span class="rn-field-affix" id="cur-sym">${esc(CURRENCIES[d.currency].sym)}</span><input name="amount" inputmode="decimal" placeholder="0" value="${esc(d.amount)}" autocomplete="off"><span class="rn-field-affix" id="cyc-unit">/ ${unitOf(d.cycle)}</span>`)}
    </div>
    <div class="form-row">
      ${field('上次续费日期', `<input type="date" name="lastPaid" value="${esc(d.lastPaid)}">`)}
      ${field('下次到期', `<input type="date" name="nextDue" value="${esc(d.nextDue)}">`, `<span id="next-hint">${d.nextManual && auto ? `已手动修改 · <button type="button" data-act="auto-next">按周期算：${fmtDate(auto)}</button>` : '按上次续费日期和周期自动计算'}</span>`)}
    </div>
    <div class="rn-field"><span class="rn-field-label">到期提醒</span><div class="choice-row">${LEADS.map((n) => `<button type="button" class="rn-chip" data-lead="${n}" aria-pressed="${d.lead === n}">${n === 0 ? '当天' : '提前 ' + n + ' 天'}</button>`).join('')}</div>
      <span class="rn-field-hint">保存后点「加到日历」，iPhone 和 Mac 的日历会在这个时间提醒你。</span></div>
    <label class="switch-row"><span>自动续费（到期会自动扣款）</span><input type="checkbox" class="switch" name="autoRenew" ${d.autoRenew ? 'checked' : ''}></label>
    ${field('备注', `<textarea name="note" rows="2" maxlength="500" placeholder="例如 绑定招行信用卡、用的是美区 Apple ID">${esc(d.note)}</textarea>`)}
  </form>`;
  const foot = `${isEdit ? `<button class="rn-btn rn-btn-danger spacer" data-act="delete" data-id="${d.id}">删除</button>` : '<span class="spacer"></span>'}
    <button class="rn-btn" data-act="${isEdit ? 'back-detail' : 'close'}" data-id="${d.id}">取消</button>
    <button class="rn-btn rn-btn-primary" data-act="save-edit">保存</button>`;
  openSheet(isEdit ? '编辑会员' : '添加会员', body, foot);
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
  if (draft.nextManual || !draft.lastPaid) return;
  draft.nextDue = addCycle(draft.lastPaid, draft.cycle);
  const inp = $('#edit-form [name="nextDue"]');
  if (inp) inp.value = draft.nextDue;
}
function saveEdit() {
  readDraftFromForm();
  const amount = parseFloat(String(draft.amount).replace(/,/g, ''));
  if (!draft.name) { toast('请填写软件名称'); $('#edit-form [name="name"]').focus(); return; }
  if (!Number.isFinite(amount) || amount < 0) { toast('请填写正确的金额'); $('#edit-form [name="amount"]').focus(); return; }
  let categoryId = draft.categoryId;
  if (categoryId === '__new') {
    if (!draft.newCat) { toast('请填写新大类的名称'); $('#edit-form [name="newCat"]').focus(); return; }
    const exist = state.categories.find((c) => c.name === draft.newCat);
    if (exist) categoryId = exist.id;
    else {
      categoryId = uid();
      state.categories.push({ id: categoryId, name: draft.newCat, order: state.categories.length, updatedAt: nowStamp() });
    }
  }
  const isNew = !draft.id;
  const existing = isNew ? null : findSub(draft.id);
  const sub = normalizeSub({ ...(existing || {}), ...draft, id: draft.id || uid(), categoryId, amount, updatedAt: nowStamp(), createdAt: existing ? existing.createdAt : nowStamp() });
  if (isNew && sub.lastPaid) sub.history = [{ id: uid(), date: sub.lastPaid, amount: sub.amount, currency: sub.currency, plan: sub.plan }];
  if (isNew) state.subs.push(sub); else state.subs[state.subs.findIndex((s) => s.id === sub.id)] = sub;
  if (!save()) return;
  render();
  toast(isNew ? '已添加 ' + sub.name : '已保存');
  if (isNew) closeSheet(); else openDetail(sub.id);
}

/* ---------- icon upload ---------- */
function pickIcon() {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'image/*';
  inp.onchange = async () => {
    const file = inp.files && inp.files[0];
    if (!file) return;
    try {
      readDraftFromForm();
      draft.icon = await fileToIcon(file);
      renderEdit(!!draft.id);
    } catch (e) { toast('这张图片读不出来，换一张试试'); }
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
  const date = todayISO();
  const body = `<form class="form" id="renew-form" data-id="${s.id}" novalidate>
    <div class="detail-top" style="grid-template-columns:auto 1fr">${appIcon(s, 40)}<div class="rn-card-id"><p class="rn-name">${esc(s.name)}</p><p class="rn-plan">当前 ${esc(planLine(s))} · ${esc(money(s.currency, s.amount))}</p></div></div>
    ${field('续费日期', `<input type="date" name="date" value="${date}">`)}
    ${field('套餐', `<input name="plan" maxlength="40" value="${esc(s.plan)}" autocomplete="off">`, '换了套餐就在这里改，会同步更新到卡片上')}
    <div class="form-row">
      ${field('币种', `<select name="currency">${Object.entries(CURRENCIES).map(([k, v]) => `<option value="${k}"${s.currency === k ? ' selected' : ''}>${v.sym} ${v.name}</option>`).join('')}</select>${icon('down', 16)}`)}
      ${field('金额', `<input name="amount" inputmode="decimal" value="${esc(s.amount)}" autocomplete="off">`)}
    </div>
    <p class="rn-field-hint" id="renew-next" style="margin:0"></p>
  </form>`;
  const foot = `<span class="spacer"></span><button class="rn-btn" data-act="back-detail" data-id="${s.id}">取消</button><button class="rn-btn rn-btn-primary" data-act="save-renew" data-id="${s.id}">记下这笔</button>`;
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
function saveRenew(id) {
  const f = $('#renew-form');
  const s = findSub(id);
  const date = f.date.value;
  const amount = parseFloat(String(f.amount.value).replace(/,/g, ''));
  if (!isISO(date)) { toast('请选择续费日期'); return; }
  if (!Number.isFinite(amount) || amount < 0) { toast('请填写正确的金额'); return; }
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
  if (!save()) return;
  render();
  openDetail(id);
  toast('已记下，下次到期 ' + fmtDate(s.nextDue));
}

/* ---------- categories ---------- */
function openCats() {
  const cats = [...state.categories].sort((a, b) => a.order - b.order);
  const body = `<div class="cat-list">${cats.map((c, i) => {
    const n = state.subs.filter((s) => s.categoryId === c.id).length;
    return `<div class="cat-item">
      <span class="rn-field-box"><input data-cat-name="${c.id}" value="${esc(c.name)}" maxlength="20" aria-label="大类名称"></span>
      <span class="count">${n} 项</span>
      <span style="display:flex"><button class="rn-btn rn-btn-plain rn-btn-icon" data-act="cat-up" data-id="${c.id}" aria-label="上移" ${i === 0 ? 'disabled' : ''}>${icon('up')}</button><button class="rn-btn rn-btn-plain rn-btn-icon" data-act="cat-down" data-id="${c.id}" aria-label="下移" ${i === cats.length - 1 ? 'disabled' : ''}>${icon('down')}</button></span>
      <button class="rn-btn rn-btn-plain rn-btn-icon rn-btn-danger" data-act="cat-del" data-id="${c.id}" aria-label="删除大类">${icon('trash')}</button>
    </div>`;
  }).join('') || '<p class="muted" style="margin:0">还没有大类。</p>'}</div>
  <form id="cat-add" class="form-row" style="grid-template-columns:1fr auto;align-items:end">
    ${field('新建大类', '<input name="name" placeholder="例如 AI 工具、云存储、学习" maxlength="20">')}
    <button class="rn-btn" type="submit">${icon('plus')}添加</button>
  </form>
  <p class="rn-field-hint" style="margin-top:12px">改名后点输入框外面就会保存。删除大类时，里面的会员会移到「未分类」。</p>`;
  openSheet('管理大类', body, '');
}
function moveCat(id, dir) {
  const cats = [...state.categories].sort((a, b) => a.order - b.order);
  const i = cats.findIndex((c) => c.id === id), j = i + dir;
  if (j < 0 || j >= cats.length) return;
  [cats[i], cats[j]] = [cats[j], cats[i]];
  cats.forEach((c, k) => { c.order = k; c.updatedAt = nowStamp(); });
  save(); render(); openCats();
}

/* ---------- settings ---------- */
function openSettings() {
  const st = state.settings;
  const body = `<div class="form">
    <div class="rn-field"><span class="rn-field-label">汇率（1 单位外币 = 多少人民币），用于估算每月花费</span>
      <div class="rates">${Object.entries(CURRENCIES).filter(([k]) => k !== 'CNY').map(([k, v]) => field(`${v.name} ${v.sym}`, `<input data-rate="${k}" inputmode="decimal" value="${esc(st.rates[k])}">`, '')).join('')}</div>
    </div>
    <div class="rn-field"><span class="rn-field-label">提前几天算「即将到期」</span><div class="choice-row">${[3, 7, 14].map((n) => `<button type="button" class="rn-chip" data-soon="${n}" aria-pressed="${st.soonWindow === n}">${n} 天</button>`).join('')}</div></div>
    <div class="rn-field"><span class="rn-field-label">新会员默认提醒</span><div class="choice-row">${LEADS.map((n) => `<button type="button" class="rn-chip" data-deflead="${n}" aria-pressed="${st.defaultLead === n}">${n === 0 ? '当天' : '提前 ' + n + ' 天'}</button>`).join('')}</div></div>
    <div class="rn-field"><span class="rn-field-label">数据</span>
      <span class="rn-field-hint">数据只保存在这台设备的浏览器里。换设备或清理浏览器数据前，记得先「导出备份」。</span>
      <div class="choice-row" style="margin-top:4px"><button class="rn-btn rn-btn-sm" data-act="export">${icon('upload', 16)}导出备份</button><button class="rn-btn rn-btn-sm" data-act="import">${icon('download', 16)}导入备份</button><button class="rn-btn rn-btn-sm rn-btn-danger" data-act="wipe">${icon('trash', 16)}清空全部数据</button></div>
    </div>
  </div>`;
  openSheet('设置', body, '');
}

/* ================= calendar (.ics) ================= */
function icsEscape(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
function icsFold(line) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out = [];
  let cur = '', bytes = 0, limit = 75;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > limit) { out.push(cur); cur = ''; bytes = 0; limit = 74; }
    cur += ch; bytes += b;
  }
  out.push(cur);
  return out.join('\r\n ');
}
function rruleFor(s) {
  const day = parseD(s.nextDue).getDate();
  const monthDay = day > 28 ? ';BYMONTHDAY=' + Array.from({ length: day - 27 }, (_, i) => 28 + i).join(',') + ';BYSETPOS=-1' : '';
  switch (s.cycle) {
    case 'week': return 'FREQ=WEEKLY';
    case 'month': return 'FREQ=MONTHLY' + monthDay;
    case 'quarter': return 'FREQ=MONTHLY;INTERVAL=3' + monthDay;
    case 'halfyear': return 'FREQ=MONTHLY;INTERVAL=6' + monthDay;
    default: return 'FREQ=YEARLY';
  }
}
function veventFor(s) {
  const start = s.nextDue.replace(/-/g, '');
  const end = addDays(s.nextDue, 1).replace(/-/g, '');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  // All-day event: alarms are relative to 00:00 of the due date, so fire at 09:00 local time.
  const trigger = s.lead === 0 ? 'PT9H' : '-P' + (s.lead - 1) + 'DT15H';
  const title = `续费：${s.name}${s.plan ? ' ' + s.plan : ''}（${money(s.currency, s.amount)}）`;
  const desc = [`${catName(s.categoryId)} · ${planLine(s)}`, `${money(s.currency, s.amount)} / ${unitOf(s.cycle)}`, s.autoRenew ? '自动续费' : '需要手动续费', s.note].filter(Boolean).join('\n');
  return [
    'BEGIN:VEVENT', `UID:${s.id}@xufeibu`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${start}`, `DTEND;VALUE=DATE:${end}`,
    `RRULE:${rruleFor(s)}`, `SUMMARY:${icsEscape(title)}`, `DESCRIPTION:${icsEscape(desc)}`, 'TRANSP:TRANSPARENT',
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEscape(s.name + (s.lead === 0 ? ' 今天到期' : ' ' + s.lead + ' 天后到期'))}`, `TRIGGER:${trigger}`, 'END:VALARM',
    'END:VEVENT'
  ];
}
function addDays(iso, n) { const d = parseD(iso); d.setDate(d.getDate() + n); return toISO(d); }
function buildICS(list) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//XuFeiBu//Renewals//ZH', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:续费簿']
    .concat(...list.map(veventFor), ['END:VCALENDAR']);
  return lines.map(icsFold).join('\r\n') + '\r\n';
}
const isIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function deliverICS(list, filename) {
  const ics = buildICS(list);
  if (isIOS()) {
    // iOS opens a tapped text/calendar link in its "Add to Calendar" sheet; a real tap is the most reliable trigger.
    const href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics);
    openSheet('加到日历', `<p style="margin:0 0 16px">点下面的按钮，iPhone 会打开「添加到日历」，再点「全部添加」即可。${list.length > 1 ? `一共 ${list.length} 项，` : ''}提醒会按续费周期自动重复。</p>
      <div class="form"><a class="rn-btn rn-btn-primary" href="${href}" target="_blank" rel="noopener">${icon('calendar')}打开日历邀请</a>
      <a class="rn-btn" href="${href}" download="${esc(filename)}">${icon('download')}存成文件</a></div>
      <p class="rn-field-hint" style="margin-top:12px">加到 iPhone 的日历后，只要 iCloud 日历是打开的，Mac 上也会同步提醒。</p>`, '');
    return;
  }
  downloadBlob(new Blob([ics], { type: 'text/calendar;charset=utf-8' }), filename);
  toast('已下载日历文件，双击它就能加到「日历」');
}
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* ================= backup ================= */
async function exportBackup() {
  const name = `续费簿备份-${todayISO()}.json`;
  const blob = new Blob([JSON.stringify({ app: 'xufeibu', exportedAt: nowStamp(), ...state }, null, 1)], { type: 'application/json' });
  const file = typeof File === 'function' ? new File([blob], name, { type: 'application/json' }) : null;
  if (isIOS() && file && navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
  }
  downloadBlob(blob, name);
  toast('已导出 ' + name);
}
function importBackup() {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = '.json,application/json';
  inp.onchange = async () => {
    const file = inp.files && inp.files[0];
    if (!file) return;
    let incoming;
    try { incoming = normalize(JSON.parse(await file.text())); } catch (e) { toast('这个文件不是续费簿的备份'); return; }
    if (!incoming.subs.length && !incoming.categories.length) { toast('备份里没有数据'); return; }
    const body = `<p style="margin:0 0 16px">备份里有 <b>${incoming.subs.length}</b> 个会员、<b>${incoming.categories.length}</b> 个大类。这台设备现在有 ${state.subs.length} 个会员。</p>
      <div class="form">
        <button class="rn-btn rn-btn-primary" data-act="import-merge">合并：两边都保留，同一个会员以较新的修改为准</button>
        <button class="rn-btn rn-btn-danger" data-act="import-replace">替换：用备份覆盖这台设备上的全部数据</button>
      </div>`;
    importBackup.pending = incoming;
    openSheet('导入备份', body, '');
  };
  inp.click();
}
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
function loadDemo() {
  const t = todayISO();
  const cat = (name, order) => ({ id: uid(), name, order, updatedAt: nowStamp() });
  const ai = cat('AI 工具', 0), media = cat('影音娱乐', 1), cloud = cat('云存储', 2);
  const mk = (o) => {
    const s = normalizeSub({ id: uid(), lead: 3, autoRenew: true, ...o });
    s.history = [{ id: uid(), date: s.lastPaid, amount: s.amount, currency: s.currency, plan: s.plan }];
    return s;
  };
  const back = (cycle, daysAhead) => { const next = addDays(t, daysAhead); return { nextDue: next, lastPaid: addCycle(next, cycle, -1) }; };
  state.categories.push(ai, media, cloud);
  state.subs.push(
    mk({ categoryId: ai.id, name: 'Claude', plan: 'Max 5x', cycle: 'month', currency: 'USD', amount: 100, ...back('month', 5) }),
    mk({ categoryId: ai.id, name: 'ChatGPT', plan: 'Plus', cycle: 'month', currency: 'USD', amount: 20, ...back('month', 17) }),
    mk({ categoryId: media.id, name: '网易云音乐', plan: '黑胶 VIP', cycle: 'year', currency: 'CNY', amount: 158, autoRenew: false, ...back('year', -5) }),
    mk({ categoryId: media.id, name: '爱奇艺', plan: '黄金会员', cycle: 'month', currency: 'CNY', amount: 25, paused: true, ...back('month', 12) }),
    mk({ categoryId: cloud.id, name: 'iCloud+', plan: '200GB', cycle: 'month', currency: 'CNY', amount: 21, ...back('month', 12) })
  );
  save(); render();
  toast('已载入示例，可以随时删掉');
}

/* ================= events ================= */
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { el.hidden = true; }, 2600);
}

document.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-act],[data-open],[data-filter],[data-view],[data-cycle],[data-lead],[data-soon],[data-deflead]');
  if (ui.menuOpen && !(t && t.dataset.act === 'menu')) { ui.menuOpen = false; render(); }
  if (!t) return;
  const d = t.dataset;

  if (d.open) { openDetail(d.open); return; }
  if (d.filter) { ui.filter = d.filter; render(); return; }
  if (d.view) { state.settings.view = d.view; save(); render(); return; }
  if (d.cycle) { readDraftFromForm(); draft.cycle = d.cycle; updateNextAuto(); renderEdit(!!draft.id); return; }
  if (d.lead) { readDraftFromForm(); draft.lead = Number(d.lead); renderEdit(!!draft.id); return; }
  if (d.soon) { state.settings.soonWindow = Number(d.soon); save(); render(); openSettings(); return; }
  if (d.deflead) { state.settings.defaultLead = Number(d.deflead); save(); openSettings(); return; }

  e.preventDefault();
  const s = d.id ? findSub(d.id) : null;
  switch (d.act) {
    case 'menu': ui.menuOpen = !ui.menuOpen; render(); break;
    case 'close': closeSheet(); break;
    case 'add': ui.menuOpen = false; openEdit(null); break;
    case 'demo': loadDemo(); break;
    case 'edit': openEdit(d.id); break;
    case 'back-detail': d.id ? openDetail(d.id) : closeSheet(); break;
    case 'save-edit': saveEdit(); break;
    case 'pick-icon': pickIcon(); break;
    case 'clear-icon': readDraftFromForm(); draft.icon = ''; renderEdit(!!draft.id); break;
    case 'auto-next': readDraftFromForm(); draft.nextManual = false; updateNextAuto(); renderEdit(!!draft.id); break;
    case 'renew': openRenew(d.id); break;
    case 'save-renew': saveRenew(d.id); break;
    case 'rm-hist':
      if (s && confirm('删除这条续费记录？')) { s.history = s.history.filter((h) => h.id !== d.hid); s.updatedAt = nowStamp(); save(); openDetail(s.id); }
      break;
    case 'toggle-pause':
      if (s) { s.paused = !s.paused; s.updatedAt = nowStamp(); save(); render(); openDetail(s.id); toast(s.paused ? '已标记停订。如果之前加过日历提醒，记得在「日历」里删掉' : '已恢复续费'); }
      break;
    case 'delete':
      if (s && confirm(`删除「${s.name}」和它的全部续费记录？`)) {
        state.subs = state.subs.filter((x) => x.id !== s.id);
        state.deleted.push({ id: s.id, at: nowStamp() });
        save(); render(); closeSheet(); toast('已删除 ' + s.name);
      }
      break;
    case 'ics': if (s) deliverICS([s], `续费提醒-${s.name}.ics`); break;
    case 'ics-all': {
      const list = state.subs.filter((x) => !x.paused && x.nextDue);
      if (!list.length) { toast('没有需要提醒的会员'); break; }
      deliverICS(list, '续费提醒-全部.ics');
      break;
    }
    case 'cats': openCats(); break;
    case 'cat-up': moveCat(d.id, -1); break;
    case 'cat-down': moveCat(d.id, 1); break;
    case 'cat-del': {
      const c = state.categories.find((x) => x.id === d.id);
      const n = state.subs.filter((x) => x.categoryId === d.id).length;
      if (c && confirm(n ? `删除大类「${c.name}」？里面的 ${n} 个会员会移到「未分类」。` : `删除大类「${c.name}」？`)) {
        state.categories = state.categories.filter((x) => x.id !== c.id);
        state.deleted.push({ id: c.id, at: nowStamp() });
        save(); render(); openCats();
      }
      break;
    }
    case 'settings': openSettings(); break;
    case 'export': exportBackup(); break;
    case 'import': importBackup(); break;
    case 'import-merge': mergeState(importBackup.pending); save(); render(); closeSheet(); toast('已合并备份'); break;
    case 'import-replace':
      if (confirm('确定用备份覆盖这台设备上的全部数据？')) { state = importBackup.pending; save(); render(); closeSheet(); toast('已导入备份'); }
      break;
    case 'wipe':
      if (confirm('清空这台设备上的全部会员和大类？此操作不能撤销，建议先导出备份。') && confirm('再确认一次：真的清空吗？')) {
        const settings = state.settings; state = emptyState(); state.settings = settings; save(); render(); closeSheet(); toast('已清空');
      }
      break;
  }
});

document.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-open][role="button"]')) { e.preventDefault(); openDetail(e.target.dataset.open); }
  if (e.key === 'Escape' && ui.menuOpen) { ui.menuOpen = false; render(); }
});

document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.closest('#edit-form')) {
    if (t.name === 'categoryId') { $('#new-cat').hidden = t.value !== '__new'; if (t.value === '__new') $('#edit-form [name="newCat"]').focus(); }
    if (t.name === 'currency') $('#cur-sym').textContent = CURRENCIES[t.value].sym;
    if (t.name === 'lastPaid') { readDraftFromForm(); updateNextAuto(); }
    if (t.name === 'nextDue') {
      readDraftFromForm();
      const auto = draft.lastPaid ? addCycle(draft.lastPaid, draft.cycle) : '';
      draft.nextManual = !!draft.nextDue && draft.nextDue !== auto;
      $('#next-hint').innerHTML = draft.nextManual && auto ? `已手动修改 · <button type="button" data-act="auto-next">按周期算：${fmtDate(auto)}</button>` : '按上次续费日期和周期自动计算';
    }
  }
  if (t.closest('#renew-form')) updateRenewHint();
  if (t.dataset.catName) {
    const c = state.categories.find((x) => x.id === t.dataset.catName);
    const v = t.value.trim();
    if (c && v && v !== c.name) { c.name = v; c.updatedAt = nowStamp(); save(); render(); toast('已改名为 ' + v); }
    else if (c && !v) t.value = c.name;
  }
  if (t.dataset.rate) {
    const v = parseFloat(t.value);
    if (Number.isFinite(v) && v > 0) { state.settings.rates[t.dataset.rate] = v; save(); render(); }
    else t.value = state.settings.rates[t.dataset.rate];
  }
});

document.addEventListener('input', (e) => {
  if (e.target.closest('#edit-form') && e.target.name === 'name' && draft && !draft.icon) {
    const p = $('#icon-preview');
    if (p) p.innerHTML = appIcon({ name: e.target.value || '?' }, 56);
  }
});

document.addEventListener('submit', (e) => {
  e.preventDefault();
  if (e.target.id === 'cat-add') {
    const name = e.target.name.value.trim();
    if (!name) return;
    if (state.categories.some((c) => c.name === name)) { toast('已经有这个大类了'); return; }
    state.categories.push({ id: uid(), name, order: state.categories.length, updatedAt: nowStamp() });
    save(); render(); openCats();
  }
  if (e.target.id === 'edit-form') saveEdit();
});

// Close the sheet when the backdrop (outside the panel) is tapped.
document.addEventListener('DOMContentLoaded', () => {
  sheet().addEventListener('click', (e) => {
    const r = sheet().getBoundingClientRect();
    if (e.target === sheet() && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) closeSheet();
  });
  render();
  // Re-render when the day changes or the app comes back to the foreground.
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
  window.addEventListener('storage', (e) => { if (e.key === STORE_KEY) { state = load(); render(); } });
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});
