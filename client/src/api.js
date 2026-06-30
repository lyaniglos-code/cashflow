// Thin fetch wrapper that attaches the JWT and parses JSON.

const TOKEN_KEY = 'cf_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, { method = 'GET', body, isForm = false } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload;
  if (isForm) {
    payload = body; // FormData
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const res = await fetch(`/api${path}`, { method, headers, body: payload });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text };
  }
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  // auth
  register: (body) => request('/auth/register', { method: 'POST', body }),
  login: (body) => request('/auth/login', { method: 'POST', body }),
  me: () => request('/auth/me'),
  updateProfile: (body) => request('/auth/profile', { method: 'PATCH', body }),

  // transactions
  listTransactions: (limit) => request(`/transactions${limit ? `?limit=${limit}` : ''}`),
  transactionSummary: () => request('/transactions/summary'),
  uploadCsv: (formData) => request('/transactions/upload', { method: 'POST', body: formData, isForm: true }),
  clearTransactions: () => request('/transactions', { method: 'DELETE' }),
  addManualTxn: (body) => request('/transactions/manual', { method: 'POST', body }),
  addRecurring: (body) => request('/transactions/recurring', { method: 'POST', body }),
  setOpeningBalance: (amount) => request('/transactions/opening-balance', { method: 'POST', body: { amount } }),

  // forecast + ai
  dashboard: () => request('/forecast/dashboard'),
  aiStatus: () => request('/ai/status'),
  aiSummary: () => request('/ai/summary'),
  aiRecommendations: () => request('/ai/recommendations'),
  aiShortfall: () => request('/ai/shortfall'),
  chat: (messages) => request('/ai/chat', { method: 'POST', body: { messages } }),

  // scenarios + digest
  simulate: (adjustments) => request('/scenarios/simulate', { method: 'POST', body: { adjustments } }),
  digest: () => request('/digest'),
  metrics: () => request('/metrics'),

  // action plans
  listPlans: () => request('/plans'),
  savePlan: (body) => request('/plans', { method: 'POST', body }),
  planImpact: (id) => request(`/plans/${id}/impact`),
  deletePlan: (id) => request(`/plans/${id}`, { method: 'DELETE' }),

  // sms alerts
  smsStatus: () => request('/sms/status'),
  smsSendCode: (phone) => request('/sms/send-code', { method: 'POST', body: { phone } }),
  smsVerify: (code) => request('/sms/verify', { method: 'POST', body: { code } }),
  smsSettings: (body) => request('/sms/settings', { method: 'PATCH', body }),
  smsTest: (type) => request('/sms/test', { method: 'POST', body: { type } }),
  smsLog: () => request('/sms/log'),
  smsDisconnect: () => request('/sms', { method: 'DELETE' }),

  // plaid (live bank data)
  plaidStatus: () => request('/plaid/status'),
  plaidLinkToken: () => request('/plaid/link-token', { method: 'POST', body: {} }),
  plaidExchange: (publicToken, institution) =>
    request('/plaid/exchange', { method: 'POST', body: { public_token: publicToken, institution } }),
  plaidSync: () => request('/plaid/sync', { method: 'POST', body: {} }),
  plaidDisconnect: () => request('/plaid/connection', { method: 'DELETE' }),
};

// Build the SSE URL (token in query because EventSource can't set headers).
export function streamUrl() {
  const token = getToken();
  return `/api/stream${token ? `?token=${encodeURIComponent(token)}` : ''}`;
}
