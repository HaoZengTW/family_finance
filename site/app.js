import * as api from './api.js';

const $ = id => document.getElementById(id);
const names = { me: '我', wife: '老婆', joint: '共同' };
const labels = { deposit: '現金存入', withdraw: '現金提領', buy: '股票買進', sell: '股票賣出', opening_cash: '期初現金', opening_stock: '期初持股' };
const money = new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 2 });
const number = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 4 });
const quoteTime = new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', dateStyle: 'short', timeStyle: 'medium', hourCycle: 'h23' });
const taipeiToday = () => new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
const isStock = kind => ['buy', 'sell', 'opening_stock'].includes(kind);

let member;
let requestId;
let offset = 0;
let historyVersion = 0;
let dashboardVersion = 0;
let snapshot;
let prices = {};

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function feedback(id, message = '', error = false) {
  const node = $(id);
  node.textContent = message;
  node.toggleAttribute('data-error', error);
}

function errorFeedback(id, error, prefix = '') {
  if (!api.hasSession() && member) {
    showLogin('登入已過期，請重新登入。');
    return;
  }
  feedback(id, prefix + (error.message || '服務暫時無法使用'), true);
}

function showLogin(message = '') {
  member = undefined;
  snapshot = undefined;
  prices = {};
  historyVersion++;
  dashboardVersion++;
  $('workspace').hidden = true;
  $('user-bar').hidden = true;
  $('login-panel').hidden = false;
  $('switch-account').hidden = !api.hasSession();
  $('history-list').replaceChildren();
  $('holdings-body').replaceChildren();
  $('metrics').replaceChildren();
  $('holdings-note').textContent = '';
  $('items').replaceChildren();
  $('login-form').reset();
  feedback('login-status', message, Boolean(message));
}

async function enter() {
  member = await api.member();
  $('login-panel').hidden = true;
  $('switch-account').hidden = true;
  $('workspace').hidden = false;
  $('user-bar').hidden = false;
  $('identity').textContent = '登入身分 · ' + names[member.owner];
  $('filter').value = 'all';
  $('owner').value = member.owner;
  $('trade-date').value = taipeiToday();
  $('trade-date').min = '1900-01-01';
  $('trade-date').max = taipeiToday();
  offset = 0;
  resetItems();
  feedback('save-status');
  openTab('ledger');
}

$('login-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  $('login-button').disabled = true;
  feedback('login-status', '登入中…');
  try {
    await api.login(form.elements.email.value.trim(), form.elements.password.value);
    await enter();
  } catch (error) {
    showLogin(error.status === 400 ? '登入失敗，請確認 Email、密碼和帳號狀態。' : error.message);
  } finally {
    form.elements.password.value = '';
    $('login-button').disabled = !api.configured;
  }
});

async function signOut() {
  $('logout').disabled = true;
  $('switch-account').disabled = true;
  $('login-button').disabled = true;
  try {
    await api.logout();
    showLogin();
  } catch {
    showLogin('已清除這個分頁的登入狀態，伺服器登出未確認。');
  } finally {
    $('logout').disabled = false;
    $('switch-account').disabled = false;
    $('login-button').disabled = !api.configured;
  }
}
$('logout').addEventListener('click', signOut);
$('switch-account').addEventListener('click', signOut);

function openTab(tab) {
  for (const name of ['ledger', 'dashboard']) {
    $(name).hidden = tab !== name;
    $(name + '-tab').setAttribute('aria-pressed', String(tab === name));
  }
  if (tab === 'ledger') loadHistory();
  else loadDashboard();
}
$('ledger-tab').addEventListener('click', () => openTab('ledger'));
$('dashboard-tab').addEventListener('click', () => openTab('dashboard'));

function setFields(wrapper, show) {
  wrapper.hidden = !show;
  for (const field of wrapper.querySelectorAll('input, select')) field.disabled = !show;
}

function fields(row) {
  return Object.fromEntries([...row.querySelectorAll('input, select')].map(input => [input.name, input]));
}

function readItem(row) {
  const f = fields(row);
  const kind = f.kind.value;
  const base = { kind, note: f.note.value.trim() };
  if (!isStock(kind)) return { ...base, amount: Number(f.amount.value) };
  const shares = Number(f.quantity.value) * (f.unit.value === 'lot' ? Number(f.lotSize.value) : 1);
  return {
    ...base, market: f.market.value, symbol: f.symbol.value.trim().toUpperCase(), shares,
    unit: f.unit.value, lot_size: f.unit.value === 'lot' ? Number(f.lotSize.value) : null,
    price: Number(f.price.value), fee: kind === 'opening_stock' ? 0 : Number(f.fee.value),
    tax: kind === 'sell' ? Number(f.tax.value) : 0,
    funding: kind === 'opening_stock' ? 'external' : f.funding.value,
  };
}

function updateFields(row) {
  const f = fields(row);
  const kind = f.kind.value;
  const stock = isStock(kind);
  const opening = kind === 'opening_stock';
  setFields(row.querySelector('.cash-fields'), !stock);
  setFields(row.querySelector('.stock-fields'), stock);
  setFields(row.querySelector('.lot-size'), stock && f.unit.value === 'lot');
  setFields(row.querySelector('.fee'), stock && !opening);
  setFields(row.querySelector('.tax'), kind === 'sell');
  setFields(row.querySelector('.funding'), stock && !opening);
  row.querySelector('.qty-label').textContent = f.unit.value === 'lot' ? '張數' : '股數';
  row.querySelector('.price-label').textContent = opening ? '期初每股成本' : '每股成交價';
  f.price.min = opening ? '0' : '.0001';
  const item = readItem(row);
  const gross = Math.round(item.shares * item.price * 100 + 1e-8) / 100;
  const net = kind === 'sell' ? gross - item.fee - item.tax : gross + item.fee;
  const preview = row.querySelector('.preview');
  preview.hidden = !stock || !item.shares || !f.price.value;
  preview.textContent = opening
    ? `${number.format(item.shares)} 股 · 期初成本 ${money.format(gross)}`
    : `${number.format(item.shares)} 股 · 成交 ${money.format(gross)} · ${item.funding === 'external' ? '外部交割' : '帳內交割'} ${money.format(net)}`;
  f.quantity.setCustomValidity(stock && item.shares > 100_000_000 ? '換算後最多可輸入 100,000,000 股' : '');
}

function updateItemCount() {
  const rows = [...$('items').children];
  for (const [index, row] of rows.entries()) {
    row.querySelector('legend').textContent = '明細 ' + (index + 1);
    row.querySelector('.remove').disabled = rows.length === 1;
  }
  $('add-item').disabled = rows.length >= 25;
}

function addItem(focus = false) {
  if ($('items').children.length >= 25) return;
  const row = $('item-template').content.firstElementChild.cloneNode(true);
  $('items').append(row);
  updateFields(row);
  updateItemCount();
  row.addEventListener('input', () => updateFields(row));
  row.querySelector('.remove').addEventListener('click', () => {
    row.remove();
    updateItemCount();
    $('add-item').focus();
  });
  if (focus) fields(row).kind.focus();
}

function resetItems() {
  $('items').replaceChildren();
  requestId = crypto.randomUUID();
  addItem();
}
$('add-item').addEventListener('click', () => addItem(true));

$('ledger-form').addEventListener('submit', async event => {
  event.preventDefault();
  const current = member;
  const payload = {
    p_request: requestId, p_owner: $('owner').value, p_date: $('trade-date').value,
    p_items: [...$('items').children].map(readItem),
  };
  const controls = [...event.currentTarget.querySelectorAll('input,select,button')].filter(input => !input.disabled);
  controls.forEach(input => { input.disabled = true; });
  $('logout').disabled = true;
  feedback('save-status', '儲存中…');
  try {
    const id = await api.save(payload);
    if (member !== current) return;
    resetItems();
    feedback('save-status', '已儲存交易 #' + id);
    offset = 0;
    await loadHistory();
  } catch (error) {
    const prefix = !error.status || error.status >= 500 ? '儲存結果未確認。保留明細並再按一次儲存，或先查交易歷史。' : '';
    errorFeedback('save-status', error, prefix ? prefix + ' ' : '');
  } finally {
    controls.forEach(input => { input.disabled = false; });
    updateItemCount();
    $('logout').disabled = false;
  }
});

function describe(item) {
  let detail = labels[item.kind] + ' · ';
  if (isStock(item.kind)) {
    const funding = item.kind === 'opening_stock' ? '' : item.funding === 'external' ? ' · 外部資金' : ' · 帳內交割';
    const fees = item.fee ? ' · 手續費 ' + money.format(item.fee) : '';
    const tax = item.tax ? ' · 交易稅 ' + money.format(item.tax) : '';
    detail += `${item.market} ${item.symbol} · ${number.format(item.shares)} 股 × ${number.format(item.price)} 元${fees}${tax}${funding}`;
  } else detail += money.format(item.amount);
  return detail + (item.note ? ' · ' + item.note : '');
}

async function loadHistory() {
  const version = ++historyVersion;
  $('history-list').replaceChildren();
  $('pager').hidden = true;
  feedback('history-status', '載入中…');
  try {
    const rows = await api.history(offset);
    if (version !== historyVersion) return;
    feedback('history-status', rows.length ? '' : '這一頁沒有交易。');
    for (const batch of rows.slice(0, 20)) {
      const item = element('article', undefined, 'history-row');
      const top = element('div', undefined, 'section-head');
      const status = batch.voided_at ? ' · 已由' + names[batch.voided_by] + '作廢' : '';
      top.append(element('strong', `${batch.trade_date} · ${names[batch.owner]} · ${names[batch.recorded_by]}登錄${status}`));
      if (!batch.voided_at) {
        const button = element('button', '作廢', 'quiet');
        button.addEventListener('click', async () => {
          if (!confirm('作廢這批交易後，現金與持股會重新計算。確定作廢？')) return;
          button.disabled = true;
          try {
            await api.voidBatch(batch.id);
            if (member) await loadHistory();
          } catch (error) {
            errorFeedback('history-status', error);
            button.disabled = false;
          }
        });
        top.append(button);
      }
      const list = element('ul');
      for (const line of batch.items) list.append(element('li', describe(line)));
      item.append(top, list);
      $('history-list').append(item);
    }
    $('pager').hidden = !(offset || rows.length > 20);
    $('page').textContent = '第 ' + (offset / 20 + 1) + ' 頁';
    $('prev').disabled = offset === 0;
    $('next').disabled = rows.length <= 20;
  } catch (error) {
    if (version === historyVersion) errorFeedback('history-status', error);
  }
}
$('reload-history').addEventListener('click', loadHistory);
$('prev').addEventListener('click', () => { offset -= 20; loadHistory(); });
$('next').addEventListener('click', () => { offset += 20; loadHistory(); });

function renderDashboard() {
  if (!snapshot) return;
  const filter = $('filter').value;
  const owners = filter === 'all' ? Object.keys(names) : [filter];
  const holdings = Object.values(snapshot.positions).filter(p => p.shares > 0 && owners.includes(p.owner));
  const cash = owners.reduce((sum, owner) => sum + Number(snapshot.cash[owner]), 0);
  const realized = owners.reduce((sum, owner) => sum + Number(snapshot.realized[owner]), 0);
  let valued = 0;
  let marketValue = 0;
  let unrealized = 0;
  $('holdings-body').replaceChildren();
  for (const p of holdings) {
    const q = prices[p.market + ':' + p.symbol];
    const value = q ? Math.round(q.price * p.shares * 100) / 100 : null;
    const profit = value === null ? null : value - p.cost;
    if (value !== null) {
      valued++;
      marketValue += value;
      unrealized += profit;
    }
    const source = q?.tradedAt ? '富果盤中 · ' + quoteTime.format(new Date(q.tradedAt))
      : q ? (q.source === 'TWSE' ? '證交所' : '櫃買中心') + '收盤 · ' + (q.date ?? '日期未提供') : '報價暫缺';
    const values = [
      `${p.symbol} ${q?.name ?? ''} · ${p.market}`.trim(), names[p.owner], number.format(p.shares),
      number.format(p.cost / p.shares), q ? number.format(q.price) : '—',
      value === null ? '—' : money.format(value), profit === null ? '—' : money.format(profit), source,
    ];
    const row = element('tr');
    values.forEach(value => row.append(element('td', value)));
    $('holdings-body').append(row);
  }
  const missing = holdings.length - valued;
  const estimate = value => missing ? (valued ? money.format(value) + '（部分）' : '—') : money.format(value);
  const metrics = [
    ['現金餘額', money.format(cash)], ['股票估計市值', estimate(marketValue)],
    ['現金＋股票', missing ? '估值不完整' : money.format(cash + marketValue)],
    ['未實現損益', estimate(unrealized)], ['已實現損益', money.format(realized)],
  ];
  $('metrics').replaceChildren(...metrics.map(([label, value]) => {
    const card = element('div', undefined, 'card metric');
    card.append(element('p', label), element('strong', value));
    return card;
  }));
  const note = holdings.length === 0 ? '目前沒有持股。' : missing ? `${missing} 檔持倉缺少報價，已排除在估值之外。` : '';
  $('holdings-note').textContent = [note, cash < 0 ? '帳內現金為負，請核對期初金額與交割來源。' : ''].filter(Boolean).join(' ');
}

async function loadDashboard() {
  const version = ++dashboardVersion;
  $('refresh').disabled = true;
  feedback('dashboard-status', '更新中…');
  try {
    const data = await api.summary();
    if (version !== dashboardVersion) return;
    snapshot = data;
    prices = {};
    renderDashboard();
    if (Object.values(data.positions).some(p => p.shares > 0)) {
      const quotes = await api.quotes();
      if (version !== dashboardVersion) return;
      prices = quotes.quotes;
      renderDashboard();
    }
    feedback('dashboard-status');
  } catch (error) {
    if (version === dashboardVersion) errorFeedback('dashboard-status', error, '更新失敗。');
  } finally {
    if (version === dashboardVersion) $('refresh').disabled = false;
  }
}
$('refresh').addEventListener('click', loadDashboard);
$('filter').addEventListener('change', renderDashboard);

if (!api.configured) {
  $('login-button').disabled = true;
  feedback('login-status', '請先依部署指南填寫 Supabase Project URL 和 Publishable Key。');
} else if (api.hasSession()) {
  $('login-button').disabled = true;
  feedback('login-status', '確認登入狀態…');
  enter().catch(error => showLogin(error.message)).finally(() => { $('login-button').disabled = false; });
}
