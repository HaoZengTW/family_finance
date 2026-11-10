import * as api from './api.js';
import * as i18n from './i18n.js';

const { t, translateError } = i18n;
const $ = id => document.getElementById(id);
const owners = ['me', 'wife', 'joint'];
const locales = { 'zh-TW': 'zh-TW', en: 'en-US', vi: 'vi-VN' };
let money;
let number;
let quoteTime;
function makeFormatters() {
  const locale = locales[i18n.lang];
  money = new Intl.NumberFormat(locale, { style: 'currency', currency: 'TWD', maximumFractionDigits: 2 });
  number = new Intl.NumberFormat(locale, { maximumFractionDigits: 4 });
  quoteTime = new Intl.DateTimeFormat(locale, { timeZone: 'Asia/Taipei', dateStyle: 'short', timeStyle: 'medium', hourCycle: 'h23' });
}
makeFormatters();
const taipeiToday = () => new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
const isStock = kind => ['buy', 'sell', 'opening_stock'].includes(kind);

let member;
let requestId;
let offset = 0;
let historyVersion = 0;
let dashboardVersion = 0;
let snapshot;
let prices = {};
let historyRows;

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
    showLogin(t('sessionExpired'));
    return;
  }
  feedback(id, prefix + translateError(error.message), true);
}

function showLogin(message = '') {
  member = undefined;
  snapshot = undefined;
  prices = {};
  historyRows = undefined;
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
  $('identity').textContent = t('identity', { name: t(member.owner) });
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
  feedback('login-status', t('signingIn'));
  try {
    await api.login(form.elements.email.value.trim(), form.elements.password.value);
    await enter();
  } catch (error) {
    showLogin(error.status === 400 ? t('loginFailed') : translateError(error.message));
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
    showLogin(t('logoutUnconfirmed'));
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
  row.querySelector('.qty-label').textContent = t(f.unit.value === 'lot' ? 'lots' : 'shares');
  row.querySelector('.price-label').textContent = t(opening ? 'openingPrice' : 'price');
  f.price.min = opening ? '0' : '.0001';
  const item = readItem(row);
  const gross = Math.round(item.shares * item.price * 100 + 1e-8) / 100;
  const net = kind === 'sell' ? gross - item.fee - item.tax : gross + item.fee;
  const preview = row.querySelector('.preview');
  preview.hidden = !stock || !item.shares || !f.price.value;
  preview.textContent = opening
    ? t('previewOpening', { shares: number.format(item.shares), gross: money.format(gross) })
    : t('previewTrade', {
      shares: number.format(item.shares), gross: money.format(gross),
      funding: t(item.funding === 'external' ? 'settleExternal' : 'settleLedger'), net: money.format(net),
    });
  f.quantity.setCustomValidity(stock && item.shares > 100_000_000 ? t('maxShares') : '');
}

function updateItemCount() {
  const rows = [...$('items').children];
  for (const [index, row] of rows.entries()) {
    row.querySelector('legend').textContent = t('item', { n: index + 1 });
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
  feedback('save-status', t('saving'));
  try {
    const id = await api.save(payload);
    if (member !== current) return;
    resetItems();
    feedback('save-status', t('saved', { id }));
    offset = 0;
    await loadHistory();
  } catch (error) {
    const prefix = !error.status || error.status >= 500 ? t('saveUnconfirmed') : '';
    errorFeedback('save-status', error, prefix ? prefix + ' ' : '');
  } finally {
    controls.forEach(input => { input.disabled = false; });
    updateItemCount();
    $('logout').disabled = false;
  }
});

function describe(item) {
  let detail = t(item.kind) + ' · ';
  if (isStock(item.kind)) {
    const funding = item.kind === 'opening_stock' ? '' : ' · ' + t(item.funding === 'external' ? 'fundingExternal' : 'settleLedger');
    const fees = item.fee ? ' · ' + t('descFee', { v: money.format(item.fee) }) : '';
    const tax = item.tax ? ' · ' + t('descTax', { v: money.format(item.tax) }) : '';
    detail += t('descStock', { market: item.market, symbol: item.symbol, shares: number.format(item.shares), price: number.format(item.price) }) + fees + tax + funding;
  } else detail += money.format(item.amount);
  return detail + (item.note ? ' · ' + item.note : '');
}

async function loadHistory() {
  const version = ++historyVersion;
  $('history-list').replaceChildren();
  $('pager').hidden = true;
  feedback('history-status', t('loading'));
  try {
    const rows = await api.history(offset);
    if (version !== historyVersion) return;
    feedback('history-status', rows.length ? '' : t('emptyPage'));
    historyRows = rows;
    renderHistory();
  } catch (error) {
    if (version === historyVersion) errorFeedback('history-status', error);
  }
}

function renderHistory() {
  if (!historyRows) return;
  const rows = historyRows;
  $('history-list').replaceChildren();
  {
    for (const batch of rows.slice(0, 20)) {
      const item = element('article', undefined, 'history-row');
      const top = element('div', undefined, 'section-head');
      const status = batch.voided_at ? ' · ' + t('voidedBy', { by: t(batch.voided_by) }) : '';
      top.append(element('strong', t('historyHead', { date: batch.trade_date, owner: t(batch.owner), by: t(batch.recorded_by) }) + status));
      if (!batch.voided_at) {
        const button = element('button', t('void'), 'quiet');
        button.addEventListener('click', async () => {
          if (!confirm(t('confirmVoid'))) return;
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
    $('page').textContent = t('page', { n: offset / 20 + 1 });
    $('prev').disabled = offset === 0;
    $('next').disabled = rows.length <= 20;
  }
}
$('reload-history').addEventListener('click', loadHistory);
$('prev').addEventListener('click', () => { offset -= 20; loadHistory(); });
$('next').addEventListener('click', () => { offset += 20; loadHistory(); });

// 台股慣例：獲利紅色、虧損綠色，0 或無資料不上色
function profitClass(value) {
  if (value === null || value === undefined) return undefined;
  if (value > 0.005) return 'gain';
  if (value < -0.005) return 'loss';
  return undefined;
}

function renderDashboard() {
  if (!snapshot) return;
  const filter = $('filter').value;
  const selected = filter === 'all' ? owners : [filter];
  const headers = [...document.querySelectorAll('.holdings th')].map(th => th.textContent);
  const holdings = Object.values(snapshot.positions).filter(p => p.shares > 0 && selected.includes(p.owner));
  const cash = selected.reduce((sum, owner) => sum + Number(snapshot.cash[owner]), 0);
  const realized = selected.reduce((sum, owner) => sum + Number(snapshot.realized[owner]), 0);
  let valued = 0;
  let totalCost = 0;
  let marketValue = 0;
  let unrealized = 0;
  $('holdings-body').replaceChildren();
  for (const p of holdings) {
    const q = prices[p.market + ':' + p.symbol];
    const value = q ? Math.round(q.price * p.shares * 100) / 100 : null;
    const profit = value === null ? null : value - p.cost;
    totalCost += Number(p.cost);
    if (value !== null) {
      valued++;
      marketValue += value;
      unrealized += profit;
    }
    const source = q?.tradedAt ? t('intraday', { time: quoteTime.format(new Date(q.tradedAt)) })
      : q ? t(q.source === 'TWSE' ? 'closeTWSE' : 'closeTPEX', { date: q.date ?? t('noDate') }) : t('noQuote');
    const values = [
      `${p.symbol} ${q?.name ?? ''} · ${p.market}`.trim(), t(p.owner), number.format(p.shares),
      number.format(p.cost / p.shares), money.format(p.cost), q ? number.format(q.price) : '—',
      value === null ? '—' : money.format(value), profit === null ? '—' : money.format(profit), source,
    ];
    const row = element('tr');
    values.forEach((value, index) => {
      const cell = element('td', value, index === 7 ? profitClass(profit) : undefined);
      // 手機版卡片排版用：以 data-label 顯示欄位名稱
      cell.dataset.label = headers[index];
      row.append(cell);
    });
    $('holdings-body').append(row);
  }
  const missing = holdings.length - valued;
  const estimate = value => missing ? (valued ? t('partial', { v: money.format(value) }) : '—') : money.format(value);
  const metrics = [
    [t('mCash'), money.format(cash)], [t('mCost'), money.format(totalCost)], [t('mValue'), estimate(marketValue)],
    [t('mTotal'), missing ? t('incomplete') : money.format(cash + marketValue)],
    [t('mUnrealized'), estimate(unrealized), valued ? unrealized : null], [t('mRealized'), money.format(realized), realized],
  ];
  $('metrics').replaceChildren(...metrics.map(([label, value, profit]) => {
    const card = element('div', undefined, 'card metric');
    card.append(element('p', label), element('strong', value, profitClass(profit)));
    return card;
  }));
  const note = holdings.length === 0 ? t('noHoldings') : missing ? t('missingQuotes', { n: missing }) : '';
  $('holdings-note').textContent = [note, cash < 0 ? t('negativeCash') : ''].filter(Boolean).join(' ');
}

async function loadDashboard() {
  const version = ++dashboardVersion;
  $('refresh').disabled = true;
  feedback('dashboard-status', t('updating'));
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
    if (version === dashboardVersion) errorFeedback('dashboard-status', error, t('updateFailed'));
  } finally {
    if (version === dashboardVersion) $('refresh').disabled = false;
  }
}
$('refresh').addEventListener('click', loadDashboard);
$('filter').addEventListener('change', renderDashboard);

// 語言切換：重新套用靜態文字並重繪動態內容
for (const [code, label] of Object.entries(i18n.languages)) {
  const option = element('option', label);
  option.value = code;
  $('lang').append(option);
}
$('lang').value = i18n.lang;
i18n.applyStatic();
$('lang').addEventListener('change', () => {
  i18n.setLang($('lang').value);
  makeFormatters();
  if (member) $('identity').textContent = t('identity', { name: t(member.owner) });
  for (const row of $('items').children) updateFields(row);
  updateItemCount();
  renderHistory();
  renderDashboard();
});

if (!api.configured) {
  $('login-button').disabled = true;
  feedback('login-status', t('notConfigured'));
} else if (api.hasSession()) {
  $('login-button').disabled = true;
  feedback('login-status', t('checkingSession'));
  enter().catch(error => showLogin(translateError(error.message))).finally(() => { $('login-button').disabled = false; });
}
