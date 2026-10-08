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
const PAOS = [0, 3, 6, 12, 24, 36];
const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
const WD_SHORT = ['日', '一', '二', '三', '四', '五', '六'];
// Two kinds of record live side by side: a subscription that renews, and a consumable that runs out.
const KINDS = {
  sub: { label: '订阅', long: '会员订阅', icon: 'ticket', hint: '按周期续费的会员、软件、云服务' },
  item: { label: '消耗品', long: '消耗品', icon: 'bottle', hint: '化妆品、日用品：记购买日、保质期、用完的时间' }
};
const CHART_COLORS = ['#2ed0aa', '#5bb8f5', '#ffb45f', '#ff8b7a', '#a98bf0', '#8fd15c', '#ffd84d', '#6fd6c6', '#f29ec4', '#7fa8f0'];
const TABS = [
  { id: 'home', label: '总览', icon: 'home' },
  { id: 'cats', label: '分类', icon: 'layers' },
  { id: 'calendar', label: '日历', icon: 'calendar' },
  { id: 'stats', label: '统计', icon: 'chart' }
];
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)');
const DAY_MS = 86400000;
const AVG_MONTH = 30.44;

/* ================= utilities ================= */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const pad = (n) => String(n).padStart(2, '0');
const nowStamp = () => new Date().toISOString();
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function parseD(iso) { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); }
function toISO(dt) { return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate()); }
function todayISO() { return toISO(new Date()); }
function isISO(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }
function daysBetween(a, b) { return Math.round((parseD(b) - parseD(a)) / DAY_MS); }
function addDays(iso, n) { const d = parseD(iso); d.setDate(d.getDate() + n); return toISO(d); }
// Month arithmetic that clamps to the last day, so 1月31日 + 1个月 lands on 2月28/29日.
function addMonths(iso, months) {
  const d = parseD(iso);
  const day = d.getDate();
  const t = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  t.setDate(Math.min(day, last));
  return toISO(t);
}
function addCycle(iso, cycle, times = 1) {
  if (cycle === 'week') return addDays(iso, 7 * times);
  return addMonths(iso, (CYCLES[cycle] || CYCLES.month).months * times);
}
function fmtDate(iso) {
  if (!iso) return '—';
  const d = parseD(iso);
  return (d.getFullYear() === new Date().getFullYear() ? '' : d.getFullYear() + '年') + (d.getMonth() + 1) + '月' + d.getDate() + '日';
}
function fmtDateFull(iso) { const d = parseD(iso); return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日'; }
function fmtMD(iso) { const d = parseD(iso); return (d.getMonth() + 1) + '月' + d.getDate() + '日'; }
function fmtNum(n) { return Number(n || 0).toLocaleString('zh-CN', { maximumFractionDigits: 2 }); }
function yuan(n) { return '¥ ' + fmtNum(Math.round(Number(n) || 0)); }
function money(currency, amount) { return (CURRENCIES[currency] || CURRENCIES.CNY).sym + ' ' + fmtNum(amount); }
function unitOf(cycle) { return (CYCLES[cycle] || CYCLES.month).unit; }

/* ================= icons ================= */
const GLYPHS = {
  grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8"/>',
  list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.75" cy="6.5" r=".9"/><circle cx="4.75" cy="12" r=".9"/><circle cx="4.75" cy="17.5" r=".9"/>',
  home: '<path d="M4 10.5L12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z"/><path d="M9.5 20.5v-6h5v6"/>',
  layers: '<path d="M12 3.5L3.5 8 12 12.5 20.5 8z"/><path d="M4 12l8 4.25L20 12"/><path d="M4 16l8 4.25L20 16"/>',
  chart: '<path d="M4 4v16h16"/><path d="M7.75 16.5v-4M12 16.5v-7.5M16.25 16.5v-5.5"/>',
  bell: '<path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.75H5z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  calendar: '<rect x="3.75" y="5" width="16.5" height="15" rx="2.5"/><path d="M3.75 9.75h16.5M8 3v4M16 3v4"/>',
  today: '<rect x="3.75" y="5" width="16.5" height="15" rx="2.5"/><path d="M3.75 9.75h16.5M8 3v4M16 3v4"/><circle cx="12" cy="15" r="2.25"/>',
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
  left: '<path d="M14.5 5.5L8 12l6.5 6.5"/>',
  right: '<path d="M9.5 5.5L16 12l-6.5 6.5"/>',
  sparkle: '<path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z"/><path d="M18.5 16l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
  cloud: '<path d="M7 18.5h10.25a4.25 4.25 0 0 0 .6-8.46A6 6 0 0 0 6.3 9.6 4.5 4.5 0 0 0 7 18.5z"/>',
  key: '<circle cx="8" cy="15.5" r="3.75"/><path d="M10.75 12.75L19 4.5M15.75 7.75l2.5 2.5M17.75 5.75l2 2"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2.5"/><path d="M15.5 8.5V6.75a2.25 2.25 0 0 0-2.25-2.25h-6.5A2.25 2.25 0 0 0 4.5 6.75v6.5a2.25 2.25 0 0 0 2.25 2.25H8.5"/>',
  ticket: '<path d="M3.75 7.5A1.5 1.5 0 0 1 5.25 6h13.5a1.5 1.5 0 0 1 1.5 1.5v2.25a2.25 2.25 0 0 0 0 4.5v2.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-2.25a2.25 2.25 0 0 0 0-4.5z"/><path d="M15 6.5v1.5M15 11.25v1.5M15 16v1.5"/>',
  bottle: '<path d="M6.75 9h10.5v9.25A2.25 2.25 0 0 1 15 20.5H9a2.25 2.25 0 0 1-2.25-2.25z"/><path d="M5.5 5.75h13V9h-13z"/><path d="M10 3.5h4v2.25h-4z"/>',
  openbox: '<path d="M4.5 9.75L12 13.5l7.5-3.75"/><path d="M4.5 9.75v6L12 19.5l7.5-3.75v-6"/><path d="M12 13.5v6"/><path d="M4.5 9.75L7.75 4.5h8.5l3.25 5.25"/>',
  done: '<circle cx="12" cy="12" r="8.25"/><path d="M8.5 12.25l2.5 2.5 4.5-4.75"/>',
  cart: '<circle cx="10" cy="19" r="1.3"/><circle cx="17" cy="19" r="1.3"/><path d="M3 4.5h2.4l2.2 10.3h10l1.9-7.3H6.2"/>',
  tag: '<path d="M20.4 13.4l-7 7a2 2 0 0 1-2.83 0L3.5 13.3V4.5h8.8l8.1 8.07a2 2 0 0 1 0 2.83z" /><circle cx="8" cy="8.5" r="1.1"/>',
  drop: '<path d="M12 3.5s5.5 5.9 5.5 9.75a5.5 5.5 0 0 1-11 0C6.5 9.4 12 3.5 12 3.5z"/>'
};
function icon(name, size = 18) {
  return `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${GLYPHS[name] || ''}</svg>`;
}

/* ================= state ================= */
function emptyState() {
  return { version: 2, categories: [], subs: [], deleted: [], settings: { rates: { ...DEFAULT_RATES }, soonWindow: 7, defaultLead: 3, view: 'card' } };
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
// Records saved before consumables existed have no `kind`; they are subscriptions.
function normalizeSub(x) {
  const kind = x.kind === 'item' ? 'item' : 'sub';
  const base = {
    id: String(x.id), kind, categoryId: x.categoryId || '', name: String(x.name),
    icon: typeof x.icon === 'string' && x.icon.startsWith('data:image/') ? x.icon : '',
    plan: x.plan || '', currency: CURRENCIES[x.currency] ? x.currency : 'CNY', amount: Number(x.amount) || 0,
    lead: LEADS.includes(Number(x.lead)) ? Number(x.lead) : 3, note: x.note || '',
    history: Array.isArray(x.history) ? x.history.filter((h) => h && isISO(h.date)).map((h) => ({ id: h.id || uid(), date: h.date, amount: Number(h.amount) || 0, currency: CURRENCIES[h.currency] ? h.currency : 'CNY', plan: h.plan || '' })) : [],
    createdAt: x.createdAt || nowStamp(), updatedAt: x.updatedAt || nowStamp()
  };
  if (kind === 'item') {
    return Object.assign(base, {
      boughtAt: isISO(x.boughtAt) ? x.boughtAt : '',
      openedAt: isISO(x.openedAt) ? x.openedAt : '',
      expiry: isISO(x.expiry) ? x.expiry : '',
      paoMonths: PAOS.includes(Number(x.paoMonths)) ? Number(x.paoMonths) : 0,
      useUpDate: isISO(x.useUpDate) ? x.useUpDate : '',
      finishedAt: isISO(x.finishedAt) ? x.finishedAt : '',
      repurchase: !!x.repurchase
    });
  }
  return Object.assign(base, {
    cycle: CYCLES[x.cycle] ? x.cycle : 'month',
    lastPaid: isISO(x.lastPaid) ? x.lastPaid : '', nextDue: isISO(x.nextDue) ? x.nextDue : '',
    autoRenew: !!x.autoRenew, paused: !!x.paused
  });
}
function load() {
  try { return normalize(JSON.parse(localStorage.getItem(STORE_KEY))); } catch (e) { return emptyState(); }
}
let state = load();
const today = new Date();
const ui = {
  tab: 'home', filter: 'all', catIndex: 0, shown: { monthly: 0, yearly: 0 },
  calY: today.getFullYear(), calM: today.getMonth(), calSel: todayISO()
};

function persist() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch (e) {
    toast('保存失败：浏览器存储空间不足，试试删掉几个大图标', 'alert');
    return false;
  }
  if (navigator.storage && navigator.storage.persist && !persist.asked) { persist.asked = true; navigator.storage.persist().catch(() => {}); }
  return true;
}
// Every local change is saved on the device first, then pushed to the cloud shortly after.
function save() {
  const ok = persist();
  if (ok) scheduleSync();
  return ok;
}

/* ================= cloud sync (a secret GitHub gist) ================= */
const SYNC_KEY = 'xufeibu:sync';
const DATA_FILE = 'shijian-data.json';
const ICS_FILE = 'shijian.ics';
const GH_API = 'https://api.github.com';
const TOKEN_URL = 'https://github.com/settings/tokens/new?description=' + encodeURIComponent('时笺同步') + '&scopes=gist';
const SYNC_LABEL = { idle: '已开启同步', busy: '同步中…', ok: '已同步', offline: '离线，联网后自动同步', auth: '同步令牌失效', missing: '找不到云端数据', error: '同步出错，稍后重试' };
let sync = (() => { try { return JSON.parse(localStorage.getItem(SYNC_KEY)) || null; } catch (e) { return null; } })();
const syncUI = { busy: false, queued: false, timer: 0, status: 'idle' };

function saveSyncConfig() { try { if (sync) localStorage.setItem(SYNC_KEY, JSON.stringify(sync)); else localStorage.removeItem(SYNC_KEY); } catch (e) { /* private mode */ } }
const byIdCmp = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
// Sorted, so two devices holding the same records produce the same text and never push back and forth.
function dataPayload() {
  return JSON.stringify({ app: 'xufeibu', version: 2, categories: [...state.categories].sort(byIdCmp), subs: [...state.subs].sort(byIdCmp), deleted: [...state.deleted].sort(byIdCmp) });
}
function feedICS() { return buildICS(calendarRecords().sort(byIdCmp), true); }
function calendarPath() { return sync && sync.gistId ? `gist.githubusercontent.com/${sync.owner}/${sync.gistId}/raw/${ICS_FILE}` : ''; }

async function gh(path, opts = {}, token = sync && sync.token) {
  let res;
  try {
    res = await fetch(GH_API + path, {
      method: opts.method || 'GET', cache: 'no-store', body: opts.body,
      headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + token, ...(opts.body ? { 'Content-Type': 'application/json' } : {}) }
    });
  } catch (e) { throw Object.assign(new Error('offline'), { code: 'offline' }); }
  if (!res.ok) throw Object.assign(new Error('http ' + res.status), { code: { 401: 'auth', 403: 'forbidden', 404: 'missing' }[res.status] || 'error' });
  return res;
}
function syncStatusHTML() {
  if (!sync) return '';
  const s = syncUI.status;
  const tone = s === 'busy' ? 'busy' : s === 'offline' || s === 'error' ? 'warn' : s === 'auth' || s === 'missing' ? 'err' : 'ok';
  return `<button class="sync-status ${tone}" data-act="settings" aria-label="同步设置"><i></i>${SYNC_LABEL[s] || ''}</button>`;
}
function setSyncStatus(s) { syncUI.status = s; const el = $('#sync-status'); if (el) el.innerHTML = syncStatusHTML(); }
function scheduleSync(delay = 1200) { if (!sync) return; clearTimeout(syncUI.timer); syncUI.timer = setTimeout(syncNow, delay); }

// Pull the cloud copy, merge it with this device (newer edits win, deletions stick), then push the result and the calendar feed.
async function syncNow() {
  if (!sync || !sync.gistId) return;
  if (syncUI.busy) { syncUI.queued = true; return; }
  syncUI.busy = true;
  setSyncStatus('busy');
  try {
    const gist = await (await gh('/gists/' + sync.gistId)).json();
    const files = gist.files || {};
    const f = files[DATA_FILE];
    let remoteText = '';
    if (f) remoteText = f.truncated ? await (await fetch(f.raw_url, { cache: 'no-store' })).text() : f.content;
    const before = dataPayload();
    if (remoteText) { try { mergeState(normalize(JSON.parse(remoteText))); } catch (e) { /* unreadable cloud copy: this device's copy replaces it */ } }
    const after = dataPayload();
    if (after !== before) { persist(); render({ animate: false }); }
    const ics = feedICS();
    const icsFile = files[ICS_FILE];
    if (after !== remoteText || !icsFile || icsFile.truncated || icsFile.content !== ics) {
      await gh('/gists/' + sync.gistId, { method: 'PATCH', body: JSON.stringify({ files: { [DATA_FILE]: { content: after }, [ICS_FILE]: { content: ics } } }) });
    }
    sync.lastSync = nowStamp();
    saveSyncConfig();
    setSyncStatus('ok');
  } catch (e) {
    setSyncStatus({ auth: 'auth', missing: 'missing', offline: 'offline' }[e.code] || 'error');
  } finally {
    syncUI.busy = false;
    if (syncUI.queued) { syncUI.queued = false; syncNow(); }
  }
}

async function connectSync(token) {
  token = (token || '').trim();
  if (token.length < 20) { toast('请粘贴完整的 GitHub 令牌', 'alert'); return; }
  const btn = $('[data-act="sync-connect"]');
  if (btn) { btn.disabled = true; btn.textContent = '连接中…'; }
  try {
    const user = await (await gh('/user', {}, token)).json();
    // A second device finds the gist the first one created, by its data file.
    let gistId = '';
    for (let page = 1; page <= 10 && !gistId; page++) {
      const list = await (await gh(`/gists?per_page=100&page=${page}`, {}, token)).json();
      const hit = list.find((g) => g.files && g.files[DATA_FILE]);
      if (hit) gistId = hit.id;
      if (list.length < 100) break;
    }
    if (!gistId) {
      const created = await (await gh('/gists', { method: 'POST', body: JSON.stringify({ description: '时笺同步数据（由时笺 App 自动维护，请勿删除）', public: false, files: { [DATA_FILE]: { content: dataPayload() }, [ICS_FILE]: { content: feedICS() } } }) }, token)).json();
      gistId = created.id;
    }
    sync = { token, owner: user.login, gistId, lastSync: '' };
    saveSyncConfig();
    await syncNow();
    render({ animate: false });
    openSettings(true);
    toast(syncUI.status === 'ok' ? '已连接，数据已同步' : '已连接，稍后自动同步', 'cloud');
  } catch (e) {
    toast({ auth: '令牌无效，请确认复制完整', forbidden: '这个令牌没有 gist 权限，请按步骤重新创建', missing: '这个令牌没有 gist 权限，请按步骤重新创建', offline: '网络不通，请稍后再试' }[e.code] || '连接失败，请稍后再试', 'alert');
    if (btn) { btn.disabled = false; btn.textContent = '连接'; }
  }
}

/* ================= derived ================= */
const isItem = (s) => s.kind === 'item';

// A consumable can end for three reasons; whichever comes first is the one that matters.
function itemLife(s) {
  const all = [];
  if (isISO(s.expiry)) all.push({ date: s.expiry, reason: '保质期' });
  if (isISO(s.openedAt) && s.paoMonths > 0) all.push({ date: addMonths(s.openedAt, s.paoMonths), reason: `开封后 ${s.paoMonths} 个月` });
  if (isISO(s.useUpDate)) all.push({ date: s.useUpDate, reason: '预计用完' });
  all.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const win = all[0] || null;
  const start = s.openedAt || s.boughtAt || '';
  let total = null, used = null, share = 0;
  if (win && isISO(start)) {
    const t = daysBetween(start, win.date);
    if (t > 0) { total = t; used = clamp(daysBetween(start, todayISO()), 0, t); share = used / t; }
  }
  return { deadline: win ? win.date : '', reason: win ? win.reason : '', all, start, total, used, share: clamp(share, 0, 1) };
}
function describeDue(days, windowDays) {
  if (days < 0) return { status: 'overdue', label: '已过期 ' + -days + ' 天' };
  if (days === 0) return { status: 'soon', label: '今天到期' };
  if (days <= windowDays) return { status: 'soon', label: days + ' 天后到期' };
  return { status: 'active', label: '还有 ' + days + ' 天' };
}
function itemStatus(s) {
  if (s.finishedAt) return { status: 'done', label: '已用完', days: Infinity };
  const L = itemLife(s);
  if (!L.deadline) return { status: 'active', label: s.openedAt ? '使用中' : '未开封', days: Infinity };
  const days = daysBetween(todayISO(), L.deadline);
  const win = Math.max(state.settings.soonWindow, s.lead);
  if (days < 0) return { status: 'overdue', label: '已超期 ' + -days + ' 天', days };
  if (days === 0) return { status: 'soon', label: '今天到期', days };
  if (days <= win) return { status: 'soon', label: '只剩 ' + days + ' 天', days };
  return { status: 'active', label: '还能用 ' + days + ' 天', days };
}
function statusOf(s) {
  if (isItem(s)) return itemStatus(s);
  if (s.paused) return { status: 'paused', label: '已停订', days: Infinity };
  if (!s.nextDue) return { status: 'active', label: '未设到期日', days: Infinity };
  const days = daysBetween(todayISO(), s.nextDue);
  return { ...describeDue(days, Math.max(state.settings.soonWindow, s.lead)), days };
}
// Share of the current billing period already used (0–1), or null when it can't be told.
function cycleOf(s) {
  if (s.paused || !s.lastPaid || !s.nextDue) return null;
  const total = daysBetween(s.lastPaid, s.nextDue);
  if (total <= 0) return null;
  const used = clamp(daysBetween(s.lastPaid, todayISO()), 0, total);
  return { total, used, share: clamp(used / total, 0, 1) };
}
function progressOf(s) {
  if (isItem(s)) { const L = itemLife(s); return L.total ? { total: L.total, used: L.used, share: L.share } : null; }
  return cycleOf(s);
}
function rateOf(cur) { return Number(state.settings.rates[cur]) || 0; }
function monthlyCNY(s) {
  if (isItem(s) || s.paused) return 0;
  const perMonth = s.cycle === 'week' ? s.amount * 52 / 12 : s.amount / CYCLES[s.cycle].months;
  return perMonth * rateOf(s.currency);
}
// A consumable has no cycle, so its cost is spread over however long it lasts.
function itemMonthlyCNY(s) {
  if (!isItem(s) || s.finishedAt) return 0;
  const L = itemLife(s);
  if (!L.total) return 0;
  return s.amount * rateOf(s.currency) / (L.total / AVG_MONTH);
}
function costMonthly(s) { return isItem(s) ? itemMonthlyCNY(s) : monthlyCNY(s); }
function dueDateOf(s) { return isItem(s) ? itemLife(s).deadline : s.nextDue; }

function sortedCategories() {
  const cats = [...state.categories].sort((a, b) => a.order - b.order);
  if (state.subs.some((s) => !state.categories.find((c) => c.id === s.categoryId))) cats.push({ id: '', name: '未分类', order: 1e9 });
  return cats;
}
const STATUS_RANK = { overdue: 0, soon: 1, active: 2, paused: 3, done: 4 };
function recordsIn(catId) {
  const known = new Set(state.categories.map((c) => c.id));
  return state.subs
    .filter((s) => (catId ? s.categoryId === catId : !known.has(s.categoryId)))
    .sort(byUrgency);
}
function byUrgency(a, b) {
  const ra = STATUS_RANK[statusOf(a).status] ?? 9, rb = STATUS_RANK[statusOf(b).status] ?? 9;
  if (ra !== rb) return ra - rb;
  const da = dueDateOf(a) || '9999-99-99', db = dueDateOf(b) || '9999-99-99';
  if (da !== db) return da < db ? -1 : 1;
  return a.name.localeCompare(b.name, 'zh');
}
function findSub(id) { return state.subs.find((s) => s.id === id); }
function catName(id) { const c = state.categories.find((x) => x.id === id); return c ? c.name : '未分类'; }
function toneOf(name) { let h = 7; for (const ch of name) h = (h * 31 + ch.codePointAt(0)) >>> 0; return h % 6; }
function calendarRecords() {
  return state.subs.filter((s) => (isItem(s) ? !s.finishedAt && itemLife(s).deadline : !s.paused && s.nextDue));
}
// Everything due (or overdue) inside the window, oldest first — drives 总览 and the attention strip.
function upcoming(days = 30) {
  const end = addDays(todayISO(), days);
  const out = [];
  state.subs.forEach((s) => {
    const date = dueDateOf(s);
    if (!date || date > end) return;
    if (isItem(s) ? s.finishedAt : s.paused) return;
    out.push({ s, date, st: statusOf(s) });
  });
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
function totals() {
  const subMonthly = state.subs.reduce((t, s) => t + monthlyCNY(s), 0);
  const itemMonthly = state.subs.reduce((t, s) => t + itemMonthlyCNY(s), 0);
  const counts = { active: 0, soon: 0, overdue: 0, paused: 0, done: 0 };
  const kinds = { sub: 0, item: 0 };
  state.subs.forEach((s) => { counts[statusOf(s).status] = (counts[statusOf(s).status] || 0) + 1; kinds[s.kind] += 1; });
  return { subMonthly, itemMonthly, all: subMonthly + itemMonthly, counts, kinds };
}
// Real money that actually left the account, grouped by YYYY-MM.
function paidByMonth(months = 12) {
  const out = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ y: d.getFullYear(), m: d.getMonth(), key: d.getFullYear() + '-' + pad(d.getMonth() + 1), total: 0, n: 0 });
  }
  const idx = new Map(out.map((o) => [o.key, o]));
  state.subs.forEach((s) => s.history.forEach((h) => {
    const o = idx.get(h.date.slice(0, 7));
    if (o) { o.total += (Number(h.amount) || 0) * rateOf(h.currency); o.n += 1; }
  }));
  return out;
}
function paidInYear(year) {
  let total = 0, n = 0;
  state.subs.forEach((s) => s.history.forEach((h) => {
    if (h.date.slice(0, 4) === String(year)) { total += (Number(h.amount) || 0) * rateOf(h.currency); n += 1; }
  }));
  return { total, n };
}

/* ================= render: small pieces ================= */
function appIcon(s, size) {
  const name = s.name || '?';
  const inner = s.icon ? `<img src="${s.icon}" alt="">` : esc(name.trim().charAt(0).toUpperCase());
  return `<span class="app-icon${s.icon ? '' : ' tone-' + toneOf(name)}" style="--s:${size}px" role="img" aria-label="${esc(name)} 图标">${inner}</span>`;
}
function badge(st) {
  const ic = { soon: 'clock', overdue: 'alert', paused: 'pause', done: 'done' }[st.status];
  return `<span class="badge badge-${st.status}">${ic ? icon(ic, 14) : ''}${esc(st.label)}</span>`;
}
function planLine(s) {
  if (isItem(s)) return [s.plan, s.openedAt ? '已开封' : '未开封'].filter(Boolean).join(' · ') || '消耗品';
  return [s.plan, CYCLES[s.cycle].label].filter(Boolean).join(' · ');
}
function priceUnit(s) { return isItem(s) ? '一件' : unitOf(s.cycle); }
function bar(s, st, i = 0) {
  const p = progressOf(s);
  const share = st.status === 'overdue' ? 1 : p ? p.share : 0;
  return `<div class="bar bar-${st.status}" style="--i:${i}" aria-hidden="true"><i style="width:${(share * 100).toFixed(1)}%"></i></div>`;
}
// The one line that answers "so when?" — differs between a renewal and something running out.
function whenLine(s, st) {
  if (isItem(s)) {
    if (s.finishedAt) return '用完于 ' + fmtDate(s.finishedAt);
    const L = itemLife(s);
    return L.deadline ? `${L.reason} ${fmtDate(L.deadline)}` : (s.boughtAt ? '购于 ' + fmtDate(s.boughtAt) : '未设期限');
  }
  if (s.paused) return '到期后不再续费';
  return s.nextDue ? '下次 ' + fmtDate(s.nextDue) : '未设到期日';
}
function card(s, i) {
  const st = statusOf(s);
  return `<article class="card glass stagger st-${st.status}${isItem(s) ? ' is-item' : ''}" style="--i:${i}" data-open="${s.id}" tabindex="0" role="button" aria-label="${esc(s.name)}，${esc(st.label)}">
    <span class="card-edge" aria-hidden="true"></span>
    <div class="card-head">
      ${appIcon(s, 46)}
      <div class="card-id">
        <p class="name">${esc(s.name)}</p>
        <p class="plan">${isItem(s) ? icon('bottle', 13) : ''}${esc(planLine(s))}</p>
      </div>
      <div class="card-cost"><span class="amount">${esc(money(s.currency, s.amount))}</span><span class="unit">/ ${priceUnit(s)}</span></div>
    </div>
    ${bar(s, st, i)}
    <div class="card-foot"><span class="days days-${st.status}">${esc(st.label)}</span><span class="when">${esc(whenLine(s, st))}</span></div>
  </article>`;
}
function row(s, i) {
  const st = statusOf(s);
  return `<div class="row stagger st-${st.status}${isItem(s) ? ' is-item' : ''}" style="--i:${i}" data-open="${s.id}" tabindex="0" role="button" aria-label="${esc(s.name)}，${esc(st.label)}">
    ${appIcon(s, 40)}
    <div class="row-id"><p class="name">${esc(s.name)}</p><p class="plan">${esc(planLine(s))} · ${esc(whenLine(s, st))}</p></div>
    <div class="row-right"><span class="row-amt"><span class="num">${esc(money(s.currency, s.amount))}</span><span class="unit">/ ${priceUnit(s)}</span></span>${badge(st)}</div>
  </div>`;
}
function catSummary(list) {
  const monthly = list.reduce((t, s) => t + costMonthly(s), 0);
  const items = list.filter(isItem).length;
  const parts = [`${list.length} 项`];
  if (items) parts.push(`${items} 件消耗品`);
  if (monthly >= 1) parts.push(`每月约 <span class="num">${yuan(monthly)}</span>`);
  return parts.join(' · ');
}
function catHead(name, list, i) {
  return `<div class="cat-head" style="--i:${i}"><h2>${esc(name)}</h2><span class="cat-meta">${catSummary(list)}</span></div>`;
}
function listHTML(list, startIndex = 0) {
  const view = state.settings.view;
  const items = list.map((s, n) => (view === 'card' ? card : row)(s, startIndex + n)).join('');
  return view === 'card' ? `<div class="grid">${items}</div>` : `<div class="list glass">${items}</div>`;
}
function emptyHTML() {
  return `<div class="empty glass">
    <div class="empty-art">${icon('ticket', 40)}</div>
    <h2>还没有任何记录</h2>
    <p>把会员订阅记下来：什么套餐、上次什么时候续的、花了多少。化妆品、日用品这类消耗品也能记：什么时候买的、保质期到哪天、大概什么时候用完。</p>
    <div class="actions"><button class="btn btn-primary" data-act="add">${icon('plus')}开始记录</button><button class="btn" data-act="demo">${icon('sparkle')}载入示例看看</button></div>
  </div>`;
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

/* ================= render: shell ================= */
function headerHTML() {
  const now = new Date();
  const T = {
    home: { title: '时笺', sub: `${now.getMonth() + 1}月${now.getDate()}日 ${WEEKDAYS[now.getDay()]}<span id="sync-status">${syncStatusHTML()}</span>` },
    cats: { title: '分类', sub: `${state.subs.length} 项记录 · ${sortedCategories().length} 个大类 · 左右滑动翻类` },
    calendar: { title: '日历', sub: '每一笔的到期日都在这儿' },
    stats: { title: '统计', sub: '钱花在哪儿了' }
  }[ui.tab];
  const extra = {
    cats: `<button class="btn icon-btn" data-act="cats" aria-label="管理大类">${icon('folder')}</button>`,
    calendar: `<button class="btn icon-btn" data-act="cal-today" aria-label="回到今天">${icon('today')}</button>`
  }[ui.tab] || '';
  return `<header class="top">
    <div class="top-title"><h1>${T.title}</h1><p class="date">${T.sub}</p></div>
    <div class="top-actions">
      ${extra}
      <div class="menu-wrap">
        <button class="btn icon-btn" data-act="menu" aria-label="更多" aria-haspopup="menu" aria-expanded="false">${icon('more')}</button>
        <div class="menu" role="menu" hidden>
          <button role="menuitem" data-act="cats">${icon('folder')}管理大类</button>
          <button role="menuitem" data-act="ics-all">${icon('calendar')}${useSubscription() ? '订阅到日历' : '全部加到日历'}</button>
          <hr>
          <button role="menuitem" data-act="export">${icon('upload')}导出备份</button>
          <button role="menuitem" data-act="import">${icon('download')}导入备份</button>
          <hr>
          <button role="menuitem" data-act="settings">${icon('gear')}设置</button>
        </div>
      </div>
    </div>
  </header>`;
}
function tabbarHTML() {
  const mk = (t) => `<button class="tabbtn${ui.tab === t.id ? ' on' : ''}" data-tab="${t.id}" role="tab" aria-selected="${ui.tab === t.id}">${icon(t.icon, 21)}<span>${t.label}</span></button>`;
  return `<nav class="tabbar" role="tablist" aria-label="主导航">
    ${mk(TABS[0])}${mk(TABS[1])}
    <button class="tab-add" data-act="add" aria-label="添加记录">${icon('plus', 26)}</button>
    ${mk(TABS[2])}${mk(TABS[3])}
  </nav>`;
}
function render(opts = {}) {
  $('#app').innerHTML = headerHTML() + '<main id="main"></main>' + tabbarHTML();
  renderPage(opts.animate !== false);
}
function renderPage(animate = true) {
  const main = $('#main');
  main.className = 'page page-' + ui.tab + (animate && !REDUCED.matches ? ' anim' : '');
  if (!state.subs.length) { main.innerHTML = emptyHTML(); return; }
  if (ui.tab === 'home') renderHome(main);
  else if (ui.tab === 'cats') renderCats(main);
  else if (ui.tab === 'calendar') renderCalendar(main);
  else renderStats(main);
}
function setTab(id) {
  if (ui.tab === id) { window.scrollTo({ top: 0, behavior: REDUCED.matches ? 'auto' : 'smooth' }); return; }
  ui.tab = id;
  render();
  window.scrollTo(0, 0);
  if (location.hash.slice(1) !== id) history.replaceState(null, '', '#' + id);
}

/* ================= page: 总览 ================= */
function attentionHTML() {
  const list = upcoming(state.settings.soonWindow).filter((x) => x.st.status === 'soon' || x.st.status === 'overdue');
  if (!list.length) return '';
  return `<div class="attention glass" role="status"><span class="attention-title">${icon('bell', 16)}需要留意</span>${list.map((x) => `<button class="att-item ${x.st.status}" data-open="${x.s.id}">${appIcon(x.s, 28)}${esc(x.s.name)}<span class="tag">${esc(x.st.label)}</span></button>`).join('')}</div>`;
}
function renderHome(main) {
  const t = totals();
  const soonList = upcoming(30);
  const thisMonth = paidByMonth(1)[0];
  const itemsLive = state.subs.filter((s) => isItem(s) && !s.finishedAt);
  const itemsSoon = itemsLive.filter((s) => ['soon', 'overdue'].includes(statusOf(s).status)).length;

  main.innerHTML = `
    <section class="hero glass">
      <div>
        <span class="hero-label">每月订阅支出约</span>
        <div class="hero-num"><span class="cur">¥</span><span id="hero-monthly">${fmtNum(ui.shown.monthly)}</span></div>
        <span class="hero-sub">每年约 <span class="num">¥ <span id="hero-yearly">${fmtNum(ui.shown.yearly)}</span></span>${t.itemMonthly >= 1 ? ` · 加上消耗品摊销每月 <span class="num">${yuan(t.all)}</span>` : ''}</span>
      </div>
      <div class="hero-stats">
        <span class="stat"><b>${t.counts.active + t.counts.soon + t.counts.overdue}</b>项在用</span>
        ${t.counts.soon ? `<span class="stat stat-soon"><b>${t.counts.soon}</b>即将到期</span>` : ''}
        ${t.counts.overdue ? `<span class="stat stat-overdue"><b>${t.counts.overdue}</b>已过期</span>` : ''}
      </div>
    </section>
    ${attentionHTML()}
    <section class="minis">
      <button class="mini glass" data-tab="cats"><span class="k">${icon('bottle', 15)}消耗品</span><span class="v">${itemsLive.length} 件在用</span><span class="s">${itemsSoon ? itemsSoon + ' 件快用完' : '都还充裕'}</span></button>
      <button class="mini glass" data-tab="stats"><span class="k">${icon('cart', 15)}本月已付</span><span class="v">${yuan(thisMonth.total)}</span><span class="s">${thisMonth.n} 笔记录</span></button>
      <button class="mini glass" data-tab="stats"><span class="k">${icon('chart', 15)}每月合计</span><span class="v">${yuan(t.all)}</span><span class="s">订阅 + 消耗品摊销</span></button>
    </section>
    <section class="block">
      <div class="block-head"><h2>接下来 30 天</h2><button class="link" data-tab="calendar">看日历 ${icon('right', 14)}</button></div>
      ${soonList.length ? `<ol class="timeline glass">${soonList.map((x, i) => timelineItem(x, i)).join('')}</ol>` : '<p class="hollow glass">这 30 天没有要到期的，安心。</p>'}
    </section>
    <section class="block">
      <div class="block-head"><h2>全部记录</h2><button class="link" data-tab="cats">按大类浏览 ${icon('right', 14)}</button></div>
      ${listHTML([...state.subs].sort(byUrgency).slice(0, 6), 0)}
      ${state.subs.length > 6 ? `<button class="btn more-btn" data-tab="cats">还有 ${state.subs.length - 6} 项，去分类里看全部</button>` : ''}
    </section>`;

  countUp($('#hero-monthly'), ui.shown.monthly, Math.round(t.subMonthly), (v) => { ui.shown.monthly = v; });
  countUp($('#hero-yearly'), ui.shown.yearly, Math.round(t.subMonthly * 12), (v) => { ui.shown.yearly = v; });
}
function timelineItem(x, i) {
  const d = parseD(x.date);
  const rel = daysBetween(todayISO(), x.date);
  const when = rel === 0 ? '今天' : rel === 1 ? '明天' : rel < 0 ? `逾期 ${-rel} 天` : `${rel} 天后`;
  return `<li class="tl st-${x.st.status}${isItem(x.s) ? ' is-item' : ''} stagger" style="--i:${i}" data-open="${x.s.id}" tabindex="0" role="button">
    <span class="tl-date"><b>${d.getMonth() + 1}/${d.getDate()}</b><i>${WD_SHORT[d.getDay()]}</i></span>
    <span class="tl-dot" aria-hidden="true"></span>
    ${appIcon(x.s, 32)}
    <span class="tl-id"><b>${esc(x.s.name)}</b><i>${isItem(x.s) ? esc(itemLife(x.s).reason || '期限') : '续费 ' + esc(money(x.s.currency, x.s.amount))}</i></span>
    <span class="tl-when">${when}</span>
  </li>`;
}

/* ================= page: 分类（左右滑动翻类） ================= */
function catPages() {
  const pages = [{ id: 'all', name: '全部', list: [...state.subs].sort(byUrgency) }];
  sortedCategories().forEach((c) => {
    const list = recordsIn(c.id);
    if (list.length) pages.push({ id: c.id || '__none', name: c.name, list });
  });
  return pages;
}
function paneHTML(p) {
  return `<div class="pane-head"><h2>${esc(p.name)}</h2><span class="cat-meta">${catSummary(p.list)}</span></div>
    ${p.list.length ? listHTML(p.list) : '<p class="hollow glass">这个大类下还没有记录。</p>'}`;
}
function renderCats(main) {
  const pages = catPages();
  ui.catIndex = clamp(ui.catIndex, 0, pages.length - 1);
  const view = state.settings.view;
  main.innerHTML = `
    <div class="catbar-row">
      <div class="catbar" role="tablist" aria-label="大类">${pages.map((p, i) => `<button class="chip" data-page="${i}" role="tab" aria-pressed="${i === ui.catIndex}">${esc(p.name)} <span class="count">${p.list.length}</span></button>`).join('')}</div>
      <div class="seg glass" role="radiogroup" aria-label="显示方式" data-value="${view}">
        <span class="seg-thumb" aria-hidden="true"></span>
        <button class="seg-opt" role="radio" data-view="card" aria-checked="${view === 'card'}">${icon('grid', 16)}<span>卡片</span></button>
        <button class="seg-opt" role="radio" data-view="list" aria-checked="${view === 'list'}">${icon('list', 16)}<span>清单</span></button>
      </div>
    </div>
    <div class="pager" id="pager">${pages.map((p, i) => `<section class="pane" data-index="${i}">${paneHTML(p)}</section>`).join('')}</div>
    <p class="swipe-hint">${icon('left', 14)}左右滑动，一类一类看${icon('right', 14)}</p>`;
  wirePager();
}
let pagerBound = false;
function wirePager() {
  const pager = $('#pager');
  if (!pager) return;
  const panes = $$('.pane', pager);
  if (!panes.length) return;
  const heightOf = (i) => (panes[i] ? panes[i].scrollHeight : 160);
  const tallest = () => Math.max(160, ...panes.map((p) => p.scrollHeight));
  const settle = () => {
    const i = clamp(Math.round(pager.scrollLeft / Math.max(1, pager.clientWidth)), 0, panes.length - 1);
    ui.catIndex = i;
    pager.classList.remove('sliding');
    pager.style.height = heightOf(i) + 'px';
    $$('[data-page]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.page) === i)));
    const chip = $(`[data-page="${i}"]`);
    if (chip) chip.scrollIntoView({ inline: 'center', block: 'nearest', behavior: REDUCED.matches ? 'auto' : 'smooth' });
  };
  // Open on the page we left off, without animating into it.
  pager.style.height = heightOf(ui.catIndex) + 'px';
  pager.scrollLeft = ui.catIndex * pager.clientWidth;
  let timer = 0;
  pager.addEventListener('scroll', () => {
    // While a page slides in, give the strip room for the tallest one so nothing is clipped mid-swipe.
    pager.classList.add('sliding');
    pager.style.height = tallest() + 'px';
    clearTimeout(timer);
    timer = setTimeout(settle, 130);
  }, { passive: true });
  if (!pagerBound) {
    pagerBound = true;
    addEventListener('resize', () => {
      const p = $('#pager');
      if (!p) return;
      p.scrollLeft = ui.catIndex * p.clientWidth;
      const pane = $$('.pane', p)[ui.catIndex];
      if (pane) p.style.height = pane.scrollHeight + 'px';
    });
  }
}
function goToPage(i) {
  const pager = $('#pager');
  if (!pager) return;
  pager.scrollTo({ left: i * pager.clientWidth, behavior: REDUCED.matches ? 'auto' : 'smooth' });
}

/* ================= page: 日历 ================= */
// Only forward from the next due date — past periods are shown by what was actually paid.
function subOccurrences(s, from, to) {
  const out = [];
  if (!s.nextDue || s.nextDue > to) return out;
  let d = s.nextDue, guard = 0;
  while (d < from && guard++ < 600) { const n = addCycle(d, s.cycle, 1); if (n <= d) break; d = n; }
  guard = 0;
  while (d <= to && guard++ < 600) { out.push(d); const n = addCycle(d, s.cycle, 1); if (n <= d) break; d = n; }
  return out;
}
const EV_ORDER = { due: 0, deadline: 1, opened: 2, bought: 3, paid: 4, finished: 5 };
function monthEvents(y, m) {
  const from = toISO(new Date(y, m, 1)), to = toISO(new Date(y, m + 1, 0));
  const map = new Map();
  // Real spending is only worth showing near today; older months would just be noise.
  const paidFrom = addDays(todayISO(), -14);
  const put = (iso, ev) => {
    if (!isISO(iso) || iso < from || iso > to) return;
    ev.date = iso;
    if (!map.has(iso)) map.set(iso, []);
    map.get(iso).push(ev);
  };
  state.subs.forEach((s) => {
    if (isItem(s)) {
      const L = itemLife(s);
      if (s.boughtAt) put(s.boughtAt, { s, type: 'bought', label: '购买 ' + money(s.currency, s.amount) });
      if (s.openedAt) put(s.openedAt, { s, type: 'opened', label: '开封' });
      if (s.finishedAt) put(s.finishedAt, { s, type: 'finished', label: '用完了' });
      else if (L.deadline) put(L.deadline, { s, type: 'deadline', label: L.reason });
      s.history.forEach((h) => { if (h.date >= paidFrom && h.date !== s.boughtAt) put(h.date, { s, type: 'bought', label: '回购 ' + money(h.currency, h.amount) }); });
    } else {
      s.history.forEach((h) => { if (h.date >= paidFrom) put(h.date, { s, type: 'paid', label: '已付 ' + money(h.currency, h.amount) }); });
      if (s.paused || !s.nextDue) return;
      if (s.nextDue < todayISO()) put(s.nextDue, { s, type: 'due', label: '该续费了 ' + money(s.currency, s.amount) });
      else subOccurrences(s, from, to).forEach((iso) => put(iso, { s, type: 'due', label: '续费 ' + money(s.currency, s.amount) }));
    }
  });
  map.forEach((list) => list.sort((a, b) => (EV_ORDER[a.type] - EV_ORDER[b.type]) || a.s.name.localeCompare(b.s.name, 'zh')));
  return map;
}
function dotTone(e) {
  const n = daysBetween(todayISO(), e.date);
  if (e.type === 'due') return n < 0 ? 'overdue' : n <= state.settings.soonWindow ? 'soon' : 'active';
  if (e.type === 'deadline') return n < 0 ? 'overdue' : n <= state.settings.soonWindow ? 'soon' : 'item';
  if (e.type === 'opened') return 'opened';
  return 'past';
}
function renderCalendar(main) {
  const y = ui.calY, m = ui.calM;
  const t = todayISO();
  const now = new Date();
  const days = new Date(y, m + 1, 0).getDate();
  const lead = new Date(y, m, 1).getDay();
  const ev = monthEvents(y, m);
  const thisMonth = t.slice(0, 7) === `${y}-${pad(m + 1)}`;
  if (ui.calSel.slice(0, 7) !== `${y}-${pad(m + 1)}`) ui.calSel = thisMonth ? t : `${y}-${pad(m + 1)}-01`;

  const cells = [];
  for (let i = 0; i < lead; i++) cells.push('<span class="cal-cell blank"></span>');
  for (let d = 1; d <= days; d++) {
    const iso = `${y}-${pad(m + 1)}-${pad(d)}`;
    const list = ev.get(iso) || [];
    const wd = new Date(y, m, d).getDay();
    const pills = list.slice(0, 3).map((e, n) => `<button class="cal-pill p-${dotTone(e)}${isItem(e.s) ? ' is-item' : ''}" data-open="${e.s.id}" style="--n:${n}" title="${esc(e.label)}">${esc(e.s.name)}</button>`).join('');
    const more = list.length > 3 ? `<button class="cal-more" data-day="${iso}">还有 ${list.length - 3} 项</button>` : '';
    cells.push(`<button class="cal-cell${wd === 0 || wd === 6 ? ' off' : ''}${iso === ui.calSel ? ' is-sel' : ''}" data-day="${iso}" aria-label="${fmtDateFull(iso)}${list.length ? '，' + list.length + ' 件事' : ''}">
      <span class="cal-num${iso === t ? ' today' : ''}">${d}</span>
      ${list.length ? `<span class="cal-pills">${pills}${more}</span>` : ''}
    </button>`);
  }
  for (let i = 0; i < Math.max(0, 42 - lead - days); i++) cells.push('<span class="cal-cell blank"></span>');

  const sel = ev.get(ui.calSel) || [];
  const all = [...ev.values()].flat();
  const dueList = all.filter((e) => e.type === 'due');
  const dueTotal = dueList.reduce((n, e) => n + e.s.amount * rateOf(e.s.currency), 0);
  const deadlineN = all.filter((e) => e.type === 'deadline').length;
  const paid = paidByMonthKey(`${y}-${pad(m + 1)}`);
  const selD = parseD(ui.calSel);

  main.innerHTML = `
    <section class="cal glass">
      <div class="cal-head">
        <h2>${y} 年 ${m + 1} 月</h2>
        <button class="cal-today-chip${thisMonth ? ' on' : ''}" data-act="cal-today">
          <i>今天</i><b>${now.getMonth() + 1}月${now.getDate()}日</b>
        </button>
        <div class="cal-nav">
          <button class="cal-arrow" data-act="cal-prev" aria-label="上个月">${icon('left', 16)}</button>
          <button class="cal-arrow" data-act="cal-next" aria-label="下个月">${icon('right', 16)}</button>
        </div>
      </div>
      <div class="cal-grid">
        ${WD_SHORT.map((w, i) => `<span class="cal-wd${i === 0 || i === 6 ? ' off' : ''}">${w}</span>`).join('')}
        ${cells.join('')}
      </div>
      <div class="cal-strip">
        <span class="cs"><i class="dot dot-active"></i>${dueList.length} 笔续费<em>约 ${yuan(dueTotal)}</em></span>
        <span class="cs"><i class="dot dot-item"></i>${deadlineN} 件到期<em>消耗品</em></span>
        <span class="cs"><i class="dot dot-past"></i>已付<em>${yuan(paid)}</em></span>
      </div>
    </section>
    <section class="block">
      <div class="block-head"><h2>${selD.getMonth() + 1}月${selD.getDate()}日 ${WEEKDAYS[selD.getDay()]}</h2>${ui.calSel === t ? '<span class="pill-today">今天</span>' : ''}</div>
      ${sel.length ? `<ul class="daylist glass">${sel.map((e, i) => dayEventHTML(e, i)).join('')}</ul>` : '<p class="hollow glass">这天没有安排。</p>'}
    </section>
    <div class="cal-cta"><button class="btn btn-primary" data-act="ics-all">${icon('calendar')}${useSubscription() ? '订阅到系统日历' : '全部加到系统日历'}</button></div>`;
}
function paidByMonthKey(key) {
  let total = 0;
  state.subs.forEach((s) => s.history.forEach((h) => { if (h.date.slice(0, 7) === key) total += (Number(h.amount) || 0) * rateOf(h.currency); }));
  return total;
}
function dayEventHTML(e, i) {
  const tone = dotTone(e);
  return `<li class="dayev stagger" style="--i:${i}" data-open="${e.s.id}" tabindex="0" role="button">
    <i class="dot dot-${tone}" aria-hidden="true"></i>
    ${appIcon(e.s, 32)}
    <span class="dayev-id"><b>${esc(e.s.name)}</b><i>${esc(catName(e.s.categoryId))} · ${esc(e.label)}</i></span>
    <span class="dayev-tag tag-${e.type}">${{ due: '到期', deadline: '期限', opened: '开封', bought: '购买', paid: '已付', finished: '用完' }[e.type]}</span>
  </li>`;
}

/* ================= page: 统计 ================= */
function donutHTML(parts, total) {
  const R = 52, C = 2 * Math.PI * R;
  let off = 0;
  const segs = parts.map((p, i) => {
    const len = total > 0 ? (p.value / total) * C : 0;
    const el = `<circle cx="70" cy="70" r="${R}" stroke="${p.color}" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" style="--i:${i}"/>`;
    off += len;
    return el;
  }).join('');
  return `<div class="donut-wrap">
    <svg viewBox="0 0 140 140" class="donut" role="img" aria-label="各大类每月支出占比">
      <g transform="rotate(-90 70 70)" fill="none" stroke-width="17">
        <circle cx="70" cy="70" r="${R}" class="dtrack"/>${segs}
      </g>
    </svg>
    <div class="donut-mid"><span class="k">每月合计</span><span class="v">${yuan(total)}</span></div>
  </div>`;
}
function barsHTML(months) {
  const max = Math.max(1, ...months.map((m) => m.total));
  return `<div class="bars">${months.map((m, i) => `
    <div class="bar-col" style="--i:${i}">
      <span class="bar-val">${m.total >= 1 ? fmtNum(Math.round(m.total)) : ''}</span>
      <span class="bar-stick"><i style="height:${clamp(m.total / max * 100, m.total > 0 ? 4 : 0, 100).toFixed(1)}%"></i></span>
      <span class="bar-lab${m.m === new Date().getMonth() && m.y === new Date().getFullYear() ? ' on' : ''}">${m.m + 1}月</span>
    </div>`).join('')}</div>`;
}
function renderStats(main) {
  const t = totals();
  const year = new Date().getFullYear();
  const yr = paidInYear(year);
  const months = paidByMonth(12);
  const paid12 = months.reduce((n, m) => n + m.total, 0);

  const parts = sortedCategories()
    .map((c, i) => ({ name: c.name, value: recordsIn(c.id).reduce((n, s) => n + costMonthly(s), 0), color: CHART_COLORS[i % CHART_COLORS.length] }))
    .filter((p) => p.value >= 0.5)
    .sort((a, b) => b.value - a.value);
  const partTotal = parts.reduce((n, p) => n + p.value, 0);

  const rank = state.subs.map((s) => ({ s, year: costMonthly(s) * 12 })).filter((x) => x.year >= 1).sort((a, b) => b.year - a.year).slice(0, 5);
  const rankMax = rank.length ? rank[0].year : 1;

  const liveItems = state.subs.filter((s) => isItem(s) && !s.finishedAt)
    .map((s) => ({ s, L: itemLife(s), st: statusOf(s) }))
    .sort((a, b) => (Number.isFinite(a.st.days) ? a.st.days : 1e9) - (Number.isFinite(b.st.days) ? b.st.days : 1e9));

  main.innerHTML = `
    <section class="tiles tiles-4">
      <div class="tile glass"><span class="k">订阅每月</span><span class="v">${yuan(t.subMonthly)}</span></div>
      <div class="tile glass"><span class="k">消耗品摊销</span><span class="v">${yuan(t.itemMonthly)}</span></div>
      <div class="tile glass"><span class="k">每月合计</span><span class="v">${yuan(t.all)}</span></div>
      <div class="tile glass"><span class="k">折合每年</span><span class="v">${yuan(t.all * 12)}</span></div>
    </section>

    <section class="block">
      <div class="block-head"><h2>钱花在哪一类</h2><span class="block-sub">按每月摊到的钱算</span></div>
      ${parts.length ? `<div class="chart glass chart-donut">
        ${donutHTML(parts, partTotal)}
        <ul class="legend">${parts.map((p) => `<li><i style="background:${p.color}"></i><span class="lg-name">${esc(p.name)}</span><span class="lg-val num">${yuan(p.value)}</span><span class="lg-pct num">${partTotal ? Math.round(p.value / partTotal * 100) : 0}%</span></li>`).join('')}</ul>
      </div>` : '<p class="hollow glass">还没有能算出每月花费的记录。</p>'}
    </section>

    <section class="block">
      <div class="block-head"><h2>近 12 个月实付</h2><span class="block-sub">共 ${yuan(paid12)}</span></div>
      <div class="chart glass">${barsHTML(months)}</div>
      <p class="chart-note">按每条「续费记录 / 购买记录」统计，外币已按设置里的汇率折成人民币。</p>
    </section>

    <section class="block">
      <div class="block-head"><h2>${year} 年总账</h2></div>
      <div class="minis">
        <div class="mini glass"><span class="k">${icon('cart', 15)}今年已付</span><span class="v">${yuan(yr.total)}</span><span class="s">${yr.n} 笔</span></div>
        <div class="mini glass"><span class="k">${icon('clock', 15)}折合每天</span><span class="v">${yuan(t.all * 12 / 365)}</span><span class="s">按当前在用的算</span></div>
        <div class="mini glass"><span class="k">${icon('tag', 15)}在用项目</span><span class="v">${t.kinds.sub} + ${t.kinds.item}</span><span class="s">订阅 + 消耗品</span></div>
      </div>
      ${rank.length ? `<ol class="rank glass">${rank.map((x, i) => `<li data-open="${x.s.id}" tabindex="0" role="button">
        <span class="rk">${i + 1}</span>${appIcon(x.s, 30)}
        <span class="rk-id"><b>${esc(x.s.name)}</b><i>${esc(planLine(x.s))}</i></span>
        <span class="rk-bar"><i style="width:${(x.year / rankMax * 100).toFixed(1)}%"></i></span>
        <span class="rk-val num">${yuan(x.year)}<em>/年</em></span>
      </li>`).join('')}</ol>` : ''}
    </section>

    <section class="block">
      <div class="block-head"><h2>消耗品用到哪儿了</h2><span class="block-sub">${liveItems.length} 件在用</span></div>
      ${liveItems.length ? `<ul class="useprog glass">${liveItems.map((x, i) => `<li data-open="${x.s.id}" tabindex="0" role="button" class="st-${x.st.status} stagger" style="--i:${i}">
        ${appIcon(x.s, 34)}
        <span class="up-id"><b>${esc(x.s.name)}</b><i>${x.L.deadline ? esc(x.L.reason) + ' ' + fmtDate(x.L.deadline) : (x.s.openedAt ? '已开封，未设期限' : '未开封')}</i></span>
        <span class="up-bar"><i style="width:${(x.L.share * 100).toFixed(1)}%"></i></span>
        <span class="up-val">${x.L.total ? Math.round(x.L.share * 100) + '%' : '—'}<em>${esc(x.st.label)}</em></span>
      </li>`).join('')}</ul>` : '<p class="hollow glass">还没有记消耗品。点底部的 ⊕ 就能记一件。</p>'}
    </section>`;
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

/* ---------- which kind to add ---------- */
function openKindPicker() {
  const b = (k) => `<button class="kind-pick" data-newkind="${k}">
    <span class="kind-ico">${icon(KINDS[k].icon, 26)}</span>
    <span><b>记一笔${KINDS[k].long}</b><i>${KINDS[k].hint}</i></span>
    ${icon('right', 18)}
  </button>`;
  openSheet('添加记录', `<div class="kind-picks">${b('sub')}${b('item')}</div>`, '');
}

/* ---------- detail ---------- */
function openDetail(id) {
  const s = findSub(id);
  if (!s) return;
  openSheet(isItem(s) ? '消耗品详情' : '会员详情', isItem(s) ? itemDetailBody(s) : subDetailBody(s), '');
}
function detailHero(s) {
  return `<div class="detail-hero">${appIcon(s, 64)}<div style="min-width:0"><p class="name">${esc(s.name)}</p><p class="plan">${esc(catName(s.categoryId))} · ${esc(planLine(s))}</p></div></div>`;
}
function historyBlock(s, title) {
  const hist = [...s.history].sort((a, b) => (a.date < b.date ? 1 : -1));
  return `<div>
    <p class="section-title">${title}</p>
    ${hist.length ? `<ul class="history">${hist.map((h) => `<li><span class="dot"></span><span><span class="date">${fmtDateFull(h.date)}</span> <span class="muted">${esc(h.plan)}</span></span><span class="num">${esc(money(h.currency, h.amount))}</span><button class="rm" data-act="rm-hist" data-id="${s.id}" data-hid="${h.id}" aria-label="删除这条记录">${icon('close', 16)}</button></li>`).join('')}</ul>` : '<p class="muted" style="margin:0 0 24px 4px;font-size:14px">还没有记录。</p>'}
  </div>`;
}
function subDetailBody(s) {
  const st = statusOf(s);
  const c = cycleOf(s);
  const foreign = !s.paused && (s.currency !== 'CNY' || s.cycle !== 'month');
  return `${detailHero(s)}
    <div>
      <div class="detail-price"><span class="amount">${esc(money(s.currency, s.amount))}</span><span class="unit">/ ${unitOf(s.cycle)}</span>${badge(st)}</div>
      ${s.paused ? '' : `${bar(s, st)}<div class="cycle-cap"><span>${st.status === 'overdue' ? `已超过到期日 ${-st.days} 天，记得续费或标记停订` : c ? `本期已过 ${c.used} 天` : ''}</span><span>${c && st.status !== 'overdue' ? `共 ${c.total} 天` : ''}</span></div>`}
    </div>
    <div class="tiles">
      <div class="tile"><span class="k">上次续费</span><span class="v">${fmtDate(s.lastPaid)}</span></div>
      <div class="tile"><span class="k">${s.paused ? '到期后' : '下次到期'}</span><span class="v">${s.paused ? '不再续费' : fmtDate(s.nextDue)}</span></div>
      <div class="tile"><span class="k">提醒</span><span class="v">${s.lead === 0 ? '到期当天' : '提前 ' + s.lead + ' 天'}</span></div>
      <div class="tile"><span class="k">${foreign ? '折合每月' : '扣费方式'}</span><span class="v">${foreign ? yuan(monthlyCNY(s)) : s.autoRenew ? '自动续费' : '手动续费'}</span></div>
    </div>
    ${s.note ? `<p class="note">${esc(s.note)}</p>` : ''}
    <div class="detail-actions">
      ${s.paused ? '' : `<button class="btn btn-primary" data-act="renew" data-id="${s.id}">${icon('renew')}记一笔续费</button>`}
      ${s.paused || !s.nextDue ? '' : `<button class="btn" data-act="ics" data-id="${s.id}">${icon('calendar')}${useSubscription() ? '日历提醒' : '加到日历'}</button>`}
      <button class="btn" data-act="edit" data-id="${s.id}">${icon('edit')}编辑</button>
    </div>
    ${historyBlock(s, '续费记录')}
    <div class="danger-zone">
      <button class="btn btn-sm" data-act="toggle-pause" data-id="${s.id}">${icon(s.paused ? 'play' : 'pause', 16)}${s.paused ? '恢复续费' : '标记停订'}</button>
      <button class="btn btn-sm btn-danger" data-act="delete" data-id="${s.id}">${icon('trash', 16)}删除</button>
    </div>`;
}
function itemDetailBody(s) {
  const st = statusOf(s);
  const L = itemLife(s);
  const perMonth = itemMonthlyCNY(s);
  const cap = s.finishedAt ? `已在 ${fmtDate(s.finishedAt)} 用完`
    : L.total ? `${s.openedAt ? '开封后' : '买来'}已过 ${L.used} 天` : '没设期限，算不出进度';
  return `${detailHero(s)}
    <div>
      <div class="detail-price"><span class="amount">${esc(money(s.currency, s.amount))}</span><span class="unit">/ 一件</span>${badge(st)}</div>
      ${s.finishedAt ? '' : `${bar(s, st)}<div class="cycle-cap"><span>${cap}</span><span>${L.total ? '共 ' + L.total + ' 天' : ''}</span></div>`}
    </div>
    <div class="tiles">
      <div class="tile"><span class="k">购买日期</span><span class="v">${fmtDate(s.boughtAt)}</span></div>
      <div class="tile"><span class="k">开封日期</span><span class="v">${s.openedAt ? fmtDate(s.openedAt) : '未开封'}</span></div>
      <div class="tile"><span class="k">保质期至</span><span class="v">${fmtDate(s.expiry)}</span></div>
      <div class="tile"><span class="k">开封后可用</span><span class="v">${s.paoMonths ? s.paoMonths + ' 个月' : '不限'}</span></div>
      <div class="tile"><span class="k">预计用完</span><span class="v">${fmtDate(s.useUpDate)}</span></div>
      <div class="tile"><span class="k">摊到每月</span><span class="v">${perMonth >= 0.5 ? yuan(perMonth) : '—'}</span></div>
    </div>
    ${L.deadline ? `<p class="deadline-note">${icon('alert', 15)}<span>最先到的是<b>${esc(L.reason)}</b>：${fmtDateFull(L.deadline)}${L.all.length > 1 ? `（另外还有${L.all.slice(1).map((a) => a.reason + ' ' + fmtDate(a.date)).join('、')}）` : ''}</span></p>` : ''}
    ${s.note ? `<p class="note">${esc(s.note)}</p>` : ''}
    <div class="detail-actions">
      ${s.finishedAt ? `<button class="btn btn-primary" data-act="unfinish" data-id="${s.id}">${icon('renew')}还没用完，撤销</button>`
        : `${s.openedAt ? '' : `<button class="btn btn-primary" data-act="open-item" data-id="${s.id}">${icon('openbox')}今天开封了</button>`}
           <button class="btn" data-act="finish-item" data-id="${s.id}">${icon('done')}用完了</button>`}
      <button class="btn" data-act="renew" data-id="${s.id}">${icon('cart')}记一次回购</button>
      ${s.finishedAt || !L.deadline ? '' : `<button class="btn" data-act="ics" data-id="${s.id}">${icon('calendar')}${useSubscription() ? '日历提醒' : '加到日历'}</button>`}
      <button class="btn" data-act="edit" data-id="${s.id}">${icon('edit')}编辑</button>
    </div>
    ${historyBlock(s, '购买记录')}
    <div class="danger-zone">
      <button class="btn btn-sm btn-danger" data-act="delete" data-id="${s.id}">${icon('trash', 16)}删除</button>
    </div>`;
}

/* ---------- add / edit ---------- */
let draft = null;
function defaultCat(kind) {
  if (ui.tab === 'cats') {
    const p = catPages()[ui.catIndex];
    if (p && p.id !== 'all' && p.id !== '__none') return p.id;
  }
  const real = sortedCategories().filter((c) => c.id);
  const sameKind = real.find((c) => recordsIn(c.id).some((s) => s.kind === kind));
  return (sameKind || real[0] || {}).id || '';
}
function openEdit(id, kind) {
  const s = id ? findSub(id) : null;
  const t = todayISO();
  const k = s ? s.kind : (kind || 'sub');
  const base = { id: '', kind: k, categoryId: defaultCat(k), name: '', icon: '', plan: '', currency: 'CNY', amount: '', lead: state.settings.defaultLead, note: '', history: [] };
  draft = s ? JSON.parse(JSON.stringify(s)) : (k === 'item'
    ? { ...base, boughtAt: t, openedAt: '', expiry: '', paoMonths: 0, useUpDate: '', finishedAt: '', repurchase: true }
    : { ...base, cycle: 'month', lastPaid: t, nextDue: addCycle(t, 'month'), autoRenew: true, paused: false });
  draft.nextManual = s && !isItem(s) ? s.nextDue !== (s.lastPaid ? addCycle(s.lastPaid, s.cycle) : '') : false;
  renderEdit(!!s);
}
function nextHint() {
  const auto = draft.lastPaid ? addCycle(draft.lastPaid, draft.cycle) : '';
  return draft.nextManual && auto ? `已手动修改 · <button type="button" data-act="auto-next">按周期算：${fmtDate(auto)}</button>` : '按上次续费日期和周期自动计算';
}
function itemHint() {
  const L = itemLife(normalizeSub({ ...draft, id: 'x', amount: 0 }));
  if (!L.deadline) return '三个日期至少填一个，才能算出什么时候该换新的。';
  return `最先到的是<b>${esc(L.reason)}</b>：${fmtDateFull(L.deadline)}`;
}
function iconPickHTML() {
  return `${appIcon({ name: draft.name || '?', icon: draft.icon }, 60)}
    <button type="button" class="btn btn-sm" data-act="pick-icon">${icon('upload', 16)}${draft.icon ? '更换图标' : '上传图标'}</button>
    ${draft.icon ? '<button type="button" class="btn btn-sm btn-plain" data-act="clear-icon">移除</button>' : ''}`;
}
function catSelectHTML() {
  const cats = [...state.categories].sort((a, b) => a.order - b.order);
  if (!cats.length && !draft.categoryId) draft.categoryId = '__new';
  const isNewCat = draft.categoryId === '__new';
  const known = cats.some((c) => c.id === draft.categoryId);
  return cats.map((c) => `<option value="${c.id}"${c.id === draft.categoryId ? ' selected' : ''}>${esc(c.name)}</option>`).join('') +
    `<option value=""${!known && !isNewCat ? ' selected' : ''}>未分类</option><option value="__new"${isNewCat ? ' selected' : ''}>+ 新建大类…</option>`;
}
function renderEdit(isEdit, still = false) {
  const d = draft;
  const item = d.kind === 'item';
  const isNewCat = d.categoryId === '__new';
  const common = `
    ${isEdit ? '' : `<div class="field"><span class="field-label">记什么</span><div class="choice-row">${Object.keys(KINDS).map((k) => `<button type="button" class="chip" data-newkind="${k}" aria-pressed="${d.kind === k}">${icon(KINDS[k].icon, 15)}${KINDS[k].long}</button>`).join('')}</div></div>`}
    <div class="field"><span class="field-label">图标</span><div class="icon-pick" id="icon-pick">${iconPickHTML()}</div>
      <span class="field-hint">从相册或文件选一张图，会自动裁成正方形。</span></div>
    ${field(item ? '名称' : '软件名称', `<input name="name" required maxlength="40" placeholder="${item ? '例如 兰蔻小黑瓶' : '例如 Claude'}" value="${esc(d.name)}" autocomplete="off">`)}
    ${field('大类', `<select name="categoryId">${catSelectHTML()}</select>${icon('down', 16)}`)}
    <label class="field" id="new-cat" ${isNewCat ? '' : 'hidden'}><span class="field-label">新大类名称</span><span class="field-box"><input name="newCat" placeholder="${item ? '例如 美妆个护、家居消耗' : '例如 AI 工具、影音娱乐'}" maxlength="20" value="${esc(d.newCat || '')}"></span></label>`;

  const subBody = `
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
    <div class="field"><span class="field-label">到期提醒</span><div class="choice-row">${LEADS.map((n) => `<button type="button" class="chip" data-lead="${n}" aria-pressed="${d.lead === n}">${n === 0 ? '当天' : '提前 ' + n + ' 天'}</button>`).join('')}</div>
      <span class="field-hint">保存后点「加到日历」，iPhone 和 Mac 的日历会在这个时间提醒你。</span></div>
    <label class="switch-row"><span>自动续费（到期自动扣款）</span><input type="checkbox" class="switch" name="autoRenew" ${d.autoRenew ? 'checked' : ''}></label>`;

  const itemBody = `
    ${field('规格 / 型号', `<input name="plan" maxlength="40" placeholder="例如 50ml 精华、2 支装" value="${esc(d.plan)}" autocomplete="off">`)}
    <div class="form-row">
      ${field('币种', `<select name="currency">${Object.entries(CURRENCIES).map(([k, v]) => `<option value="${k}"${d.currency === k ? ' selected' : ''}>${v.sym} ${v.name}</option>`).join('')}</select>${icon('down', 16)}`)}
      ${field('买入价格', `<span class="affix" id="cur-sym">${esc(CURRENCIES[d.currency].sym)}</span><input name="amount" inputmode="decimal" placeholder="0" value="${esc(d.amount)}" autocomplete="off">`)}
    </div>
    <div class="form-row">
      ${field('什么时候买的', `<input type="date" name="boughtAt" value="${esc(d.boughtAt)}">`)}
      ${field('保质期到什么时候', `<input type="date" name="expiry" value="${esc(d.expiry)}">`, '瓶底或包装上印的到期日')}
    </div>
    ${field('什么时候开封的', `<input type="date" name="openedAt" value="${esc(d.openedAt)}">`, '还没拆封就留空')}
    <div class="field"><span class="field-label">开封后能用多久</span><div class="choice-row">${PAOS.map((n) => `<button type="button" class="chip" data-pao="${n}" aria-pressed="${d.paoMonths === n}">${n === 0 ? '不限' : n + ' 个月'}</button>`).join('')}</div>
      <span class="field-hint">化妆品包装上那个小罐子图标里的 6M、12M 就是这个。</span></div>
    ${field('预计什么时候用完', `<input type="date" name="useUpDate" value="${esc(d.useUpDate)}">`, `<span id="item-hint">${itemHint()}</span>`)}
    <div class="field"><span class="field-label">提前多久提醒</span><div class="choice-row">${LEADS.map((n) => `<button type="button" class="chip" data-lead="${n}" aria-pressed="${d.lead === n}">${n === 0 ? '当天' : '提前 ' + n + ' 天'}</button>`).join('')}</div></div>
    <label class="switch-row"><span>用完提醒我回购</span><input type="checkbox" class="switch" name="repurchase" ${d.repurchase ? 'checked' : ''}></label>`;

  const body = `<form class="form" id="edit-form" data-kind="${d.kind}" novalidate>
    ${common}${item ? itemBody : subBody}
    ${field('备注', `<textarea name="note" rows="2" maxlength="500" placeholder="${item ? '例如 买一送一、放在卫生间柜子里' : '例如 绑定招行信用卡、用的是美区 Apple ID'}">${esc(d.note)}</textarea>`)}
  </form>`;
  const foot = `${isEdit ? `<button class="btn btn-danger spacer" data-act="delete" data-id="${d.id}">删除</button>` : '<span class="spacer"></span>'}
    <button class="btn" data-act="${isEdit ? 'back-detail' : 'close'}" data-id="${d.id}">取消</button>
    <button class="btn btn-primary" data-act="save-edit">${icon('check')}保存</button>`;
  openSheet(isEdit ? `编辑${KINDS[d.kind].long}` : `添加${KINDS[d.kind].long}`, body, foot, { still });
}
function readDraftFromForm() {
  const f = $('#edit-form');
  if (!f) return;
  const fd = new FormData(f);
  const get = (k) => (fd.get(k) || '').trim();
  draft.categoryId = fd.get('categoryId');
  draft.newCat = get('newCat');
  draft.name = get('name');
  draft.plan = get('plan');
  draft.currency = fd.get('currency');
  draft.amount = get('amount');
  draft.note = get('note');
  if (draft.kind === 'item') {
    draft.boughtAt = fd.get('boughtAt') || '';
    draft.expiry = fd.get('expiry') || '';
    draft.openedAt = fd.get('openedAt') || '';
    draft.useUpDate = fd.get('useUpDate') || '';
    draft.repurchase = !!fd.get('repurchase');
  } else {
    draft.lastPaid = fd.get('lastPaid') || '';
    draft.nextDue = fd.get('nextDue') || '';
    draft.autoRenew = !!fd.get('autoRenew');
  }
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
function updateItemHint() { const h = $('#item-hint'); if (h) h.innerHTML = itemHint(); }
function resolveCategory() {
  let categoryId = draft.categoryId;
  if (categoryId !== '__new') return categoryId;
  if (!draft.newCat) { toast('请填写新大类的名称', 'alert'); $('#edit-form [name="newCat"]').focus(); return null; }
  const exist = state.categories.find((c) => c.name === draft.newCat);
  if (exist) return exist.id;
  categoryId = uid();
  state.categories.push({ id: categoryId, name: draft.newCat, order: state.categories.length, updatedAt: nowStamp() });
  return categoryId;
}
function saveEdit() {
  readDraftFromForm();
  const item = draft.kind === 'item';
  const raw = String(draft.amount).replace(/,/g, '').trim();
  const amount = raw === '' ? (item ? 0 : NaN) : parseFloat(raw);
  if (!draft.name) { toast('请填写名称', 'alert'); $('#edit-form [name="name"]').focus(); return; }
  if (!Number.isFinite(amount) || amount < 0) { toast(item ? '价格填个数字，没花钱就填 0' : '请填写正确的金额', 'alert'); $('#edit-form [name="amount"]').focus(); return; }
  if (item && !draft.boughtAt && !draft.openedAt) { toast('至少填一个日期：购买日或开封日', 'alert'); return; }
  const categoryId = resolveCategory();
  if (categoryId === null) return;

  const isNew = !draft.id;
  const existing = isNew ? null : findSub(draft.id);
  const sub = normalizeSub({ ...(existing || {}), ...draft, id: draft.id || uid(), categoryId, amount, updatedAt: nowStamp(), createdAt: existing ? existing.createdAt : nowStamp() });
  if (isNew) {
    const first = item ? sub.boughtAt : sub.lastPaid;
    if (first) sub.history = [{ id: uid(), date: first, amount: sub.amount, currency: sub.currency, plan: sub.plan }];
  }
  if (isNew) state.subs.push(sub); else state.subs[state.subs.findIndex((s) => s.id === sub.id)] = sub;
  if (!save()) return;
  render({ animate: false });
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

/* ---------- renew (订阅) / repurchase (消耗品) ---------- */
function openRenew(id) {
  const s = findSub(id);
  if (!s) return;
  if (isItem(s)) return openRepurchase(s);
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
function openRepurchase(s) {
  const body = `<form class="form" id="repurchase-form" data-id="${s.id}" novalidate>
    <div class="detail-hero">${appIcon(s, 48)}<div style="min-width:0"><p class="name">${esc(s.name)}</p><p class="plan">上次 ${fmtDate(s.boughtAt)} 买的 · ${esc(money(s.currency, s.amount))}</p></div></div>
    ${field('这次什么时候买的', `<input type="date" name="date" value="${todayISO()}">`)}
    ${field('规格 / 型号', `<input name="plan" maxlength="40" value="${esc(s.plan)}" autocomplete="off">`)}
    <div class="form-row">
      ${field('币种', `<select name="currency">${Object.entries(CURRENCIES).map(([k, v]) => `<option value="${k}"${s.currency === k ? ' selected' : ''}>${v.sym} ${v.name}</option>`).join('')}</select>${icon('down', 16)}`)}
      ${field('价格', `<input name="amount" inputmode="decimal" value="${esc(s.amount)}" autocomplete="off">`)}
    </div>
    ${field('新的保质期', `<input type="date" name="expiry" value="${esc(s.expiry)}">`, '换成新一瓶的到期日')}
    <p class="field-hint" style="margin:0 0 0 4px">记下来之后，这件东西会回到「未开封」，开封日期和用完记录都会清空。</p>
  </form>`;
  const foot = `<span class="spacer"></span><button class="btn" data-act="back-detail" data-id="${s.id}">取消</button><button class="btn btn-primary" data-act="save-repurchase" data-id="${s.id}">${icon('check')}记下这次</button>`;
  openSheet('记一次回购', body, foot);
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
function readPayForm(f) {
  const date = f.date.value;
  const amount = parseFloat(String(f.amount.value).replace(/,/g, ''));
  if (!isISO(date)) { toast('请选择日期', 'alert'); return null; }
  if (!Number.isFinite(amount) || amount < 0) { toast('请填写正确的金额', 'alert'); return null; }
  return { date, amount, plan: f.plan.value.trim(), currency: f.currency.value };
}
function saveRenew(id) {
  const s = findSub(id);
  const v = readPayForm($('#renew-form'));
  if (!s || !v) return;
  s.history.push({ id: uid(), ...v });
  if (!s.lastPaid || v.date >= s.lastPaid) {
    s.nextDue = renewNextDue(s, v.date);
    s.lastPaid = v.date;
    s.plan = v.plan;
    s.amount = v.amount;
    s.currency = v.currency;
  }
  s.updatedAt = nowStamp();
  if (!save()) return;
  render({ animate: false });
  openDetail(id);
  toast('已记下，下次到期 ' + fmtDate(s.nextDue));
}
function saveRepurchase(id) {
  const s = findSub(id);
  const f = $('#repurchase-form');
  const v = readPayForm(f);
  if (!s || !v) return;
  s.history.push({ id: uid(), ...v });
  s.boughtAt = v.date;
  s.plan = v.plan;
  s.amount = v.amount;
  s.currency = v.currency;
  s.expiry = isISO(f.expiry.value) ? f.expiry.value : '';
  s.openedAt = '';
  s.finishedAt = '';
  s.updatedAt = nowStamp();
  if (!save()) return;
  render({ animate: false });
  openDetail(id);
  toast('已记下这次回购，现在是未开封状态', 'cart');
}

/* ---------- categories ---------- */
function openCats(still = false) {
  const cats = [...state.categories].sort((a, b) => a.order - b.order);
  const body = `<div class="cat-list">${cats.map((c, i) => {
    const list = state.subs.filter((s) => s.categoryId === c.id);
    const items = list.filter(isItem).length;
    return `<div class="cat-item">
      <span class="field-box"><input data-cat-name="${c.id}" value="${esc(c.name)}" maxlength="20" aria-label="大类名称"></span>
      <span class="count">${list.length} 项${items ? `（${items} 消耗品）` : ''}</span>
      <span style="display:flex"><button class="btn btn-plain icon-btn" data-act="cat-up" data-id="${c.id}" aria-label="上移" ${i === 0 ? 'disabled' : ''}>${icon('up')}</button><button class="btn btn-plain icon-btn" data-act="cat-down" data-id="${c.id}" aria-label="下移" ${i === cats.length - 1 ? 'disabled' : ''}>${icon('down')}</button></span>
      <button class="btn btn-plain icon-btn btn-danger" data-act="cat-del" data-id="${c.id}" aria-label="删除大类">${icon('trash')}</button>
    </div>`;
  }).join('') || '<p class="muted" style="margin:0">还没有大类。</p>'}</div>
  <form id="cat-add" class="form-row" style="grid-template-columns:1fr auto;align-items:end">
    ${field('新建大类', '<input name="name" placeholder="例如 AI 工具、影音娱乐、美妆个护" maxlength="20">')}
    <button class="btn" type="submit" style="height:46px">${icon('plus')}添加</button>
  </form>
  <p class="field-hint" style="margin:12px 0 0 4px">上下箭头调顺序，分类页左右滑动就按这个顺序走。改名后点输入框外面就会保存；删除大类时，里面的记录会移到「未分类」。</p>`;
  openSheet('管理大类', body, '', { still });
}
function moveCat(id, dir) {
  const cats = [...state.categories].sort((a, b) => a.order - b.order);
  const i = cats.findIndex((c) => c.id === id), j = i + dir;
  if (j < 0 || j >= cats.length) return;
  [cats[i], cats[j]] = [cats[j], cats[i]];
  cats.forEach((c, k) => { c.order = k; c.updatedAt = nowStamp(); });
  save(); render({ animate: false }); openCats(true);
}

/* ---------- settings ---------- */
function syncSectionHTML() {
  if (!sync) {
    return `<div class="sync-card">
      <div class="sync-head">${icon('cloud', 22)}<div><p class="sync-title">手机和电脑自动同步</p><p class="sync-sub">用你的 GitHub 账号存一份数据，两台设备自动同步，还能订阅成 iPhone 日历提醒。</p></div></div>
      <ol class="steps">
        <li>点「创建令牌」并登录 GitHub；<b>Expiration</b> 选 <b>No expiration</b>，拉到最下面点 <b>Generate token</b>。</li>
        <li>复制生成的令牌（ghp_ 开头），粘贴到下面，点「连接」。</li>
        <li>另一台设备也做一次（再建一个令牌也行），两边就会自动同步。</li>
      </ol>
      <div class="choice-row"><a class="btn btn-sm" href="${TOKEN_URL}" target="_blank" rel="noopener">${icon('key', 16)}创建令牌</a></div>
      <div class="sync-connect">${field('GitHub 令牌', '<input id="sync-token" type="password" placeholder="ghp_…" autocomplete="off" autocapitalize="off" spellcheck="false">')}<button class="btn btn-primary" data-act="sync-connect">连接</button></div>
      <p class="field-hint" style="margin:0">令牌只存在这台设备上，只能读写 gist（GitHub 上的小笔记），碰不到你的代码仓库。</p>
    </div>`;
  }
  const last = sync.lastSync ? new Date(sync.lastSync) : null;
  const when = last ? `上次同步 ${last.getMonth() + 1}月${last.getDate()}日 ${pad(last.getHours())}:${pad(last.getMinutes())}` : '还没同步过';
  const fix = syncUI.status === 'auth' ? '<p class="field-hint" style="margin:0;color:var(--coral)">令牌失效或被删除了：点「断开」，再用新令牌重新连接。</p>' : '';
  return `<div class="sync-card">
    <div class="sync-head">${icon('cloud', 22)}<div><p class="sync-title">已开启同步 · ${esc(sync.owner)}</p><p class="sync-sub">${when} · ${SYNC_LABEL[syncUI.status] || ''}</p></div></div>
    ${fix}
    <div class="choice-row"><button class="btn btn-sm btn-primary" data-act="cal-sub">${icon('calendar', 16)}订阅到日历</button><button class="btn btn-sm" data-act="sync-now">${icon('renew', 16)}立即同步</button><button class="btn btn-sm btn-danger" data-act="sync-off">断开</button></div>
  </div>`;
}
function openSettings(still = false) {
  const st = state.settings;
  const body = `${syncSectionHTML()}
    <div class="field"><span class="field-label">汇率（1 单位外币 = 多少人民币），用于估算每月花费</span>
      <div class="rates">${Object.entries(CURRENCIES).filter(([k]) => k !== 'CNY').map(([k, v]) => field(`${v.name} ${v.sym}`, `<input data-rate="${k}" inputmode="decimal" value="${esc(st.rates[k])}">`)).join('')}</div>
    </div>
    <div class="field" style="margin-top:18px"><span class="field-label">提前几天算「即将到期」</span><div class="choice-row">${[3, 7, 14].map((n) => `<button type="button" class="chip" data-soon="${n}" aria-pressed="${st.soonWindow === n}">${n} 天</button>`).join('')}</div></div>
    <div class="field" style="margin-top:18px"><span class="field-label">新记录默认提醒</span><div class="choice-row">${LEADS.map((n) => `<button type="button" class="chip" data-deflead="${n}" aria-pressed="${st.defaultLead === n}">${n === 0 ? '当天' : '提前 ' + n + ' 天'}</button>`).join('')}</div></div>
    <div class="field" style="margin-top:18px"><span class="field-label">数据</span>
      <span class="field-hint">${sync ? '数据保存在这台设备上，并同步到你的 GitHub。' : '数据只保存在这台设备里。换设备或清理浏览器数据前，记得先「导出备份」。'}</span>
      <div class="choice-row" style="margin-top:6px"><button class="btn btn-sm" data-act="export">${icon('upload', 16)}导出备份</button><button class="btn btn-sm" data-act="import">${icon('download', 16)}导入备份</button><button class="btn btn-sm btn-danger" data-act="wipe">${icon('trash', 16)}清空全部数据</button></div>
    </div>`;
  openSheet('设置', body, '', { still });
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
function icsStamp(s) {
  // Stamped with the record's last edit, so the same data always yields the same file.
  return new Date(s.updatedAt || Date.now()).toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
}
// All-day event: alarms are relative to 00:00 of the due date, so fire at 09:00 local time.
function icsTrigger(lead) { return lead === 0 ? 'PT9H' : '-P' + (lead - 1) + 'DT15H'; }
function veventFor(s) {
  return isItem(s) ? itemVevent(s) : subVevent(s);
}
function subVevent(s) {
  const start = s.nextDue.replace(/-/g, '');
  const end = addDays(s.nextDue, 1).replace(/-/g, '');
  const title = `续费：${s.name}${s.plan ? ' ' + s.plan : ''}（${money(s.currency, s.amount)}）`;
  const desc = [`${catName(s.categoryId)} · ${planLine(s)}`, `${money(s.currency, s.amount)} / ${unitOf(s.cycle)}`, s.autoRenew ? '自动续费' : '需要手动续费', s.note].filter(Boolean).join('\n');
  return [
    'BEGIN:VEVENT', `UID:${s.id}@xufeibu`, `DTSTAMP:${icsStamp(s)}`, `DTSTART;VALUE=DATE:${start}`, `DTEND;VALUE=DATE:${end}`,
    `RRULE:${rruleFor(s)}`, `SUMMARY:${icsEscape(title)}`, `DESCRIPTION:${icsEscape(desc)}`, 'TRANSP:TRANSPARENT',
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEscape(s.name + (s.lead === 0 ? ' 今天到期' : ' ' + s.lead + ' 天后到期'))}`, `TRIGGER:${icsTrigger(s.lead)}`, 'END:VALARM',
    'END:VEVENT'
  ];
}
// A consumable happens once: no RRULE, just the day it runs out or expires.
function itemVevent(s) {
  const L = itemLife(s);
  const start = L.deadline.replace(/-/g, '');
  const end = addDays(L.deadline, 1).replace(/-/g, '');
  const title = `${L.reason}：${s.name}${s.plan ? ' ' + s.plan : ''}`;
  const desc = [
    `${catName(s.categoryId)} · 消耗品${s.plan ? ' · ' + s.plan : ''}`,
    s.boughtAt ? `${fmtDateFull(s.boughtAt)} 买入 ${money(s.currency, s.amount)}` : '',
    s.openedAt ? `${fmtDateFull(s.openedAt)} 开封` : '还没开封',
    s.expiry ? `保质期至 ${fmtDateFull(s.expiry)}` : '',
    s.paoMonths ? `开封后可用 ${s.paoMonths} 个月` : '',
    s.useUpDate ? `预计 ${fmtDateFull(s.useUpDate)} 用完` : '',
    s.repurchase ? '用完记得回购' : '', s.note
  ].filter(Boolean).join('\n');
  return [
    'BEGIN:VEVENT', `UID:item-${s.id}@xufeibu`, `DTSTAMP:${icsStamp(s)}`, `DTSTART;VALUE=DATE:${start}`, `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${icsEscape(title)}`, `DESCRIPTION:${icsEscape(desc)}`, 'TRANSP:TRANSPARENT',
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEscape(s.name + '：' + L.reason + (s.lead === 0 ? ' 就是今天' : ' 还有 ' + s.lead + ' 天'))}`, `TRIGGER:${icsTrigger(s.lead)}`, 'END:VALARM',
    'END:VEVENT'
  ];
}
function buildICS(list, feed = false) {
  const head = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//XuFeiBu//Renewals//ZH', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:时笺'];
  if (feed) head.push('X-WR-CALDESC:时笺到期提醒', 'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H');
  const lines = head.concat(...list.map(veventFor), ['END:VCALENDAR']);
  return lines.map(icsFold).join('\r\n') + '\r\n';
}
const isIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
// iPhone home-screen apps can't open calendar files made in the page, so there the calendar comes from a subscription.
const useSubscription = () => !!sync || isIOS();
function deliverICS(list, filename) {
  downloadBlob(new Blob([buildICS(list)], { type: 'text/calendar;charset=utf-8' }), filename);
  toast('已下载日历文件，双击它就能加到「日历」', 'calendar');
}
function openCalSheet() {
  if (!sync) {
    openSheet('日历提醒', `<p style="margin:0 0 16px">iPhone 的主屏幕 App 打不开日历文件，所以改用「订阅日历」：先开启同步，再订阅一次，以后增删改记录，日历都会自动更新。</p>
      <div class="form"><button class="btn btn-primary" data-act="settings">${icon('cloud')}去开启同步</button></div>`, '');
    return;
  }
  const path = calendarPath();
  openSheet('订阅到日历', `
    <p style="margin:0 0 16px">订阅一次，「日历」里就会多出一个「时笺」日历：订阅的续费日按周期重复，消耗品的保质期和预计用完各是一个单独的事件，都按你设的时间提醒。以后在这里增删改，日历会自动跟着更新。</p>
    <div class="form"><a class="btn btn-primary" href="webcal://${path}">${icon('calendar')}订阅「时笺」日历</a>
      <button class="btn" data-act="copy-cal">${icon('copy')}复制订阅链接</button></div>
    <ol class="steps" style="margin:18px 0 12px">
      <li>点上面的按钮，在弹窗里点「订阅」，再点「添加」。</li>
      <li><b>打开提醒：</b>到 iPhone「设置 → App → 日历 → 日历账户 → 已订阅的日历 → 时笺」，把「移除提醒」关掉。</li>
      <li>Mac 上也点一次这个按钮（或在「日历」App 里选「文件 → 新建日历订阅」粘贴链接），在弹窗的「移除」里取消勾选「提醒」。</li>
    </ol>
    <p class="field-hint" style="margin:0">日历大约每小时刷新一次，刚改的内容可能要等一会儿才出现。以前手动加过的事件可以删掉，免得重复。</p>`, '');
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
  const name = `时笺备份-${todayISO()}.json`;
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
    try { incoming = normalize(JSON.parse(await file.text())); } catch (e) { toast('这个文件不是时笺的备份', 'alert'); return; }
    if (!incoming.subs.length && !incoming.categories.length) { toast('备份里没有数据', 'alert'); return; }
    const body = `<p style="margin:0 0 16px">备份里有 <b>${incoming.subs.length}</b> 条记录、<b>${incoming.categories.length}</b> 个大类。这台设备现在有 ${state.subs.length} 条记录。</p>
      <div class="form">
        <button class="btn btn-primary" data-act="import-merge">合并：两边都保留，同一条以较新的修改为准</button>
        <button class="btn btn-danger" data-act="import-replace">替换：用备份覆盖这台设备上的全部数据</button>
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
  const index = (arr) => new Map(arr.map((x) => [x.id, x]));
  const merge = (mine, theirs) => {
    const A = index(mine), B = index(theirs), out = [];
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
  const ai = cat('AI 工具', 0), media = cat('影音娱乐', 1), cloud = cat('云存储', 2), care = cat('美妆个护', 3), home = cat('家居消耗', 4);
  const mk = (o) => {
    const s = normalizeSub({ id: uid(), lead: 3, autoRenew: true, ...o });
    const first = s.kind === 'item' ? s.boughtAt : s.lastPaid;
    if (first) s.history = [{ id: uid(), date: first, amount: s.amount, currency: s.currency, plan: s.plan }];
    return s;
  };
  const back = (cycle, daysAhead) => { const next = addDays(t, daysAhead); return { nextDue: next, lastPaid: addCycle(next, cycle, -1) }; };
  state.categories.push(ai, media, cloud, care, home);
  state.subs.push(
    mk({ categoryId: ai.id, name: 'Claude', plan: 'Max 5x', cycle: 'month', currency: 'USD', amount: 100, ...back('month', 5) }),
    mk({ categoryId: ai.id, name: 'ChatGPT', plan: 'Plus', cycle: 'month', currency: 'USD', amount: 20, ...back('month', 17) }),
    mk({ categoryId: media.id, name: '网易云音乐', plan: '黑胶 VIP', cycle: 'year', currency: 'CNY', amount: 158, autoRenew: false, ...back('year', -5) }),
    mk({ categoryId: media.id, name: '爱奇艺', plan: '黄金会员', cycle: 'month', currency: 'CNY', amount: 25, paused: true, ...back('month', 12) }),
    mk({ categoryId: cloud.id, name: 'iCloud+', plan: '200GB', cycle: 'month', currency: 'CNY', amount: 21, ...back('month', 12) }),
    mk({ kind: 'item', categoryId: care.id, name: '兰蔻小黑瓶', plan: '50ml 精华', currency: 'CNY', amount: 890, boughtAt: addDays(t, -120), openedAt: addDays(t, -40), expiry: addMonths(t, 20), paoMonths: 6, lead: 7 }),
    mk({ kind: 'item', categoryId: care.id, name: '防晒霜', plan: 'SPF50 60ml', currency: 'CNY', amount: 220, boughtAt: addDays(t, -200), openedAt: addDays(t, -170), expiry: addDays(t, 60), paoMonths: 12, lead: 7 }),
    mk({ kind: 'item', categoryId: care.id, name: '隐形眼镜', plan: '月抛 3 片', currency: 'CNY', amount: 180, boughtAt: addDays(t, -25), openedAt: addDays(t, -25), useUpDate: addDays(t, 4), lead: 3 }),
    mk({ kind: 'item', categoryId: home.id, name: '猫粮', plan: '5kg 无谷', currency: 'CNY', amount: 320, boughtAt: addDays(t, -35), openedAt: addDays(t, -35), useUpDate: addDays(t, 18), expiry: addMonths(t, 10), lead: 7 }),
    mk({ kind: 'item', categoryId: home.id, name: '洗衣液', plan: '3kg 补充装', currency: 'CNY', amount: 59, boughtAt: addDays(t, -10), useUpDate: addDays(t, 80), lead: 3 })
  );
  save(); render();
  toast('已载入示例，可以随时删掉', 'sparkle');
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
const CLICK_SEL = '[data-act],[data-open],[data-tab],[data-page],[data-day],[data-view],[data-cycle],[data-lead],[data-pao],[data-newkind],[data-soon],[data-deflead]';

document.addEventListener('click', async (e) => {
  const t = e.target.closest(CLICK_SEL);
  if (menuOpen() && !(t && t.dataset.act === 'menu')) closeMenu();
  if (!t) return;
  const d = t.dataset;

  if (d.open) { openDetail(d.open); return; }
  if (d.tab) { closeSheet(); setTab(d.tab); return; }
  if (d.page) { goToPage(Number(d.page)); return; }
  if (d.day) {
    if (ui.calSel === d.day) return;
    ui.calSel = d.day;
    renderPage(false);
    return;
  }
  if (d.view) {
    if (state.settings.view === d.view) return;
    state.settings.view = d.view; save();
    renderPage(false);
    return;
  }
  if (d.newkind) {
    // In the form it switches the fields (keeping what's already typed); from the ⊕ sheet it starts a new record.
    if ($('#edit-form')) {
      readDraftFromForm();
      const keep = { name: draft.name, categoryId: draft.categoryId, newCat: draft.newCat, note: draft.note, icon: draft.icon, plan: draft.plan, currency: draft.currency, amount: draft.amount, lead: draft.lead };
      openEdit(null, d.newkind);
      Object.assign(draft, keep);
      renderEdit(false, true);
    } else openEdit(null, d.newkind);
    return;
  }
  if (d.cycle) {
    readDraftFromForm(); draft.cycle = d.cycle;
    setPressed('[data-cycle]', (b) => b.dataset.cycle === d.cycle);
    $('#cyc-unit').textContent = '/ ' + unitOf(d.cycle);
    updateNextAuto();
    return;
  }
  if (d.pao) {
    readDraftFromForm(); draft.paoMonths = Number(d.pao);
    setPressed('[data-pao]', (b) => b.dataset.pao === d.pao);
    updateItemHint();
    return;
  }
  if (d.lead) { draft.lead = Number(d.lead); setPressed('[data-lead]', (b) => b.dataset.lead === d.lead); return; }
  if (d.soon) { state.settings.soonWindow = Number(d.soon); save(); setPressed('[data-soon]', (b) => b.dataset.soon === d.soon); render({ animate: false }); return; }
  if (d.deflead) { state.settings.defaultLead = Number(d.deflead); save(); setPressed('[data-deflead]', (b) => b.dataset.deflead === d.deflead); return; }

  e.preventDefault();
  const s = d.id ? findSub(d.id) : null;
  switch (d.act) {
    case 'menu': menuOpen() ? closeMenu() : openMenu(); break;
    case 'close': closeSheet(); break;
    case 'add': openKindPicker(); break;
    case 'demo': loadDemo(); break;
    case 'edit': openEdit(d.id); break;
    case 'back-detail': d.id ? openDetail(d.id) : closeSheet(); break;
    case 'save-edit': saveEdit(); break;
    case 'pick-icon': readDraftFromForm(); pickIcon(); break;
    case 'clear-icon': draft.icon = ''; $('#icon-pick').innerHTML = iconPickHTML(); break;
    case 'auto-next': readDraftFromForm(); draft.nextManual = false; updateNextAuto(); break;
    case 'renew': openRenew(d.id); break;
    case 'save-renew': saveRenew(d.id); break;
    case 'save-repurchase': saveRepurchase(d.id); break;
    case 'cal-prev': { const n = new Date(ui.calY, ui.calM - 1, 1); ui.calY = n.getFullYear(); ui.calM = n.getMonth(); renderPage(true); break; }
    case 'cal-next': { const n = new Date(ui.calY, ui.calM + 1, 1); ui.calY = n.getFullYear(); ui.calM = n.getMonth(); renderPage(true); break; }
    case 'cal-today': {
      const n = new Date();
      ui.calY = n.getFullYear(); ui.calM = n.getMonth(); ui.calSel = todayISO();
      if (ui.tab !== 'calendar') setTab('calendar'); else renderPage(true);
      break;
    }
    case 'open-item':
      if (s) { s.openedAt = todayISO(); s.updatedAt = nowStamp(); save(); render({ animate: false }); openDetail(s.id); toast('已记下开封日期', 'openbox'); }
      break;
    case 'finish-item':
      if (s) {
        s.finishedAt = todayISO(); s.updatedAt = nowStamp(); save(); render({ animate: false }); openDetail(s.id);
        toast(s.repurchase ? '已标记用完，记得回购' : '已标记用完', 'done');
      }
      break;
    case 'unfinish':
      if (s) { s.finishedAt = ''; s.updatedAt = nowStamp(); save(); render({ animate: false }); openDetail(s.id); toast('已撤销'); }
      break;
    case 'rm-hist':
      if (s && confirm('删除这条记录？')) { s.history = s.history.filter((h) => h.id !== d.hid); s.updatedAt = nowStamp(); save(); openDetail(s.id); }
      break;
    case 'toggle-pause':
      if (s) { s.paused = !s.paused; s.updatedAt = nowStamp(); save(); render({ animate: false }); openDetail(s.id); toast(s.paused ? '已标记停订。之前加过日历提醒的话，记得去「日历」里删掉' : '已恢复续费', s.paused ? 'pause' : 'play'); }
      break;
    case 'delete':
      if (s && confirm(`删除「${s.name}」和它的全部记录？`)) {
        state.subs = state.subs.filter((x) => x.id !== s.id);
        state.deleted.push({ id: s.id, at: nowStamp() });
        save(); render({ animate: false }); closeSheet(); toast('已删除 ' + s.name, 'trash');
      }
      break;
    case 'ics': if (useSubscription()) openCalSheet(); else if (s) deliverICS([s], `到期提醒-${s.name}.ics`); break;
    case 'ics-all': {
      if (useSubscription()) { openCalSheet(); break; }
      const list = calendarRecords();
      if (!list.length) { toast('没有需要提醒的记录', 'alert'); break; }
      deliverICS(list, '时笺到期提醒.ics');
      break;
    }
    case 'cal-sub': openCalSheet(); break;
    case 'copy-cal':
      try { await navigator.clipboard.writeText('https://' + calendarPath()); toast('订阅链接已复制', 'copy'); } catch (err) { prompt('复制这个订阅链接：', 'https://' + calendarPath()); }
      break;
    case 'sync-connect': connectSync(($('#sync-token') || {}).value); break;
    case 'sync-now': await syncNow(); openSettings(true); toast(syncUI.status === 'ok' ? '已同步' : SYNC_LABEL[syncUI.status], syncUI.status === 'ok' ? 'cloud' : 'alert'); break;
    case 'sync-off':
      if (confirm('在这台设备上断开同步？这台设备和 GitHub 上的数据都会保留。')) { sync = null; saveSyncConfig(); render({ animate: false }); openSettings(true); toast('已断开同步'); }
      break;
    case 'cats': openCats(); break;
    case 'cat-up': moveCat(d.id, -1); break;
    case 'cat-down': moveCat(d.id, 1); break;
    case 'cat-del': {
      const c = state.categories.find((x) => x.id === d.id);
      const n = state.subs.filter((x) => x.categoryId === d.id).length;
      if (c && confirm(n ? `删除大类「${c.name}」？里面的 ${n} 条记录会移到「未分类」。` : `删除大类「${c.name}」？`)) {
        state.categories = state.categories.filter((x) => x.id !== c.id);
        state.deleted.push({ id: c.id, at: nowStamp() });
        ui.catIndex = 0;
        save(); render({ animate: false }); openCats(true);
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
      if (confirm(sync ? '清空全部记录和大类？已开启同步，其他设备上的也会一起清空。此操作不能撤销，建议先导出备份。' : '清空这台设备上的全部记录和大类？此操作不能撤销，建议先导出备份。') && confirm('再确认一次：真的清空吗？')) {
        // Leave deletion marks so a synced device doesn't bring the records back.
        const at = nowStamp();
        const deleted = [...state.subs, ...state.categories].map((x) => ({ id: x.id, at })).concat(state.deleted);
        const settings = state.settings;
        state = emptyState(); state.settings = settings; state.deleted = deleted;
        ui.shown = { monthly: 0, yearly: 0 }; ui.catIndex = 0;
        save(); render(); closeSheet(); toast('已清空', 'trash');
      }
      break;
  }
});

document.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-open][role="button"]')) { e.preventDefault(); openDetail(e.target.dataset.open); }
  if (e.key === 'Escape' && menuOpen()) closeMenu();
  if (!sheet().open && ui.tab === 'cats' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !e.target.matches('input,textarea,select')) {
    goToPage(clamp(ui.catIndex + (e.key === 'ArrowRight' ? 1 : -1), 0, catPages().length - 1));
  }
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
      $('#next-hint').innerHTML = nextHint();
    }
    if (['boughtAt', 'openedAt', 'expiry', 'useUpDate'].includes(t.name)) { readDraftFromForm(); updateItemHint(); }
  }
  if (t.closest('#renew-form')) updateRenewHint();
  if (t.dataset.catName) {
    const c = state.categories.find((x) => x.id === t.dataset.catName);
    const v = t.value.trim();
    if (c && v && v !== c.name) { c.name = v; c.updatedAt = nowStamp(); save(); render({ animate: false }); toast('已改名为 ' + v); }
    else if (c && !v) t.value = c.name;
  }
  if (t.dataset.rate) {
    const v = parseFloat(t.value);
    if (Number.isFinite(v) && v > 0) { state.settings.rates[t.dataset.rate] = v; save(); render({ animate: false }); }
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

document.addEventListener('submit', (e) => {
  e.preventDefault();
  if (e.target.id === 'cat-add') {
    const name = e.target.name.value.trim();
    if (!name) return;
    if (state.categories.some((c) => c.name === name)) { toast('已经有这个大类了', 'alert'); return; }
    state.categories.push({ id: uid(), name, order: state.categories.length, updatedAt: nowStamp() });
    save(); render({ animate: false }); openCats(true);
  }
  if (e.target.id === 'edit-form') saveEdit();
});

addEventListener('hashchange', () => {
  const h = location.hash.slice(1);
  if (TABS.some((t) => t.id === h) && h !== ui.tab) { ui.tab = h; render(); }
});

document.addEventListener('DOMContentLoaded', () => {
  const h = location.hash.slice(1);
  if (TABS.some((t) => t.id === h)) ui.tab = h;
  const d = sheet();
  // Tapping the dimmed backdrop, or pressing Esc, closes the sheet with its exit animation.
  d.addEventListener('click', (e) => {
    const r = d.getBoundingClientRect();
    if (e.target === d && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) closeSheet();
  });
  d.addEventListener('cancel', (e) => { e.preventDefault(); closeSheet(); });
  render();
  // Refresh the day counts and pull the other device's changes when the app comes back to the foreground.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    if (!sheet().open) render({ animate: false });
    syncNow();
  });
  syncNow();
  setInterval(() => { if (!document.hidden) syncNow(); }, 30000);
  window.addEventListener('storage', (e) => { if (e.key === STORE_KEY) { state = load(); render({ animate: false }); } });
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});
