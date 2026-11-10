import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';

const url = SUPABASE_URL.replace(/\/$/, '');
const storageKey = 'family-session:' + url;
let session;
try { session = JSON.parse(sessionStorage.getItem(storageKey)); } catch { session = null; }
let refreshing;

export const configured = !SUPABASE_URL.includes('YOUR_PROJECT_REF') &&
  !SUPABASE_PUBLISHABLE_KEY.includes('REPLACE_ME');
export const hasSession = () => Boolean(session?.refresh_token);

function setSession(data) {
  session = data ? { ...data, expires_at: data.expires_at ?? Date.now() / 1000 + data.expires_in } : null;
  if (session) sessionStorage.setItem(storageKey, JSON.stringify(session));
  else sessionStorage.removeItem(storageKey);
}

async function call(path, { body, token, method = body === undefined ? 'GET' : 'POST' } = {}) {
  const headers = { apikey: SUPABASE_PUBLISHABLE_KEY };
  if (token) headers.Authorization = 'Bearer ' + token;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(url + path, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(25_000),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.msg ?? data?.message ?? data?.error_description ?? '服務暫時無法使用');
    error.status = response.status;
    throw error;
  }
  return data;
}

async function token(force = false) {
  if (!session) throw new Error('請先登入');
  if (!force && session.expires_at > Date.now() / 1000 + 45) return session.access_token;
  if (!refreshing) {
    const original = session;
    refreshing = call('/auth/v1/token?grant_type=refresh_token', { body: { refresh_token: session.refresh_token } })
      .then(data => {
        if (session !== original) throw new Error('登入已變更');
        setSession(data);
        return data.access_token;
      }).catch(error => {
        if (session === original && [400, 401, 403].includes(error.status)) setSession(null);
        throw error;
      }).finally(() => { refreshing = undefined; });
  }
  return refreshing;
}

async function authorized(path, options = {}) {
  const accessToken = await token();
  try { return await call(path, { ...options, token: accessToken }); }
  catch (error) {
    if (error.status !== 401 || !session) throw error;
    const current = session.access_token === accessToken ? await token(true) : await token();
    return call(path, { ...options, token: current });
  }
}

export async function login(email, password) {
  setSession(await call('/auth/v1/token?grant_type=password', { body: { email, password } }));
}

export async function logout() {
  try {
    if (session) await call('/auth/v1/logout?scope=local', { method: 'POST', token: await token() });
  } finally { setSession(null); }
}

export async function member() {
  const rows = await authorized('/rest/v1/household_members?select=owner&limit=1');
  if (!rows?.length) throw new Error('此帳號尚未加入家庭帳簿');
  return rows[0];
}

export const summary = () => authorized('/rest/v1/rpc/ledger_summary', { body: {} });
export const history = offset => authorized('/rest/v1/ledger_batches?select=id,owner,trade_date,items,recorded_by,voided_at,voided_by&order=trade_date.desc,id.desc&limit=21&offset=' + offset);
export const save = payload => authorized('/rest/v1/rpc/save_batch', { body: payload });
export const voidBatch = id => authorized('/rest/v1/rpc/void_batch', { body: { p_id: id } });
export const quotes = () => authorized('/functions/v1/quotes', { body: {} });
