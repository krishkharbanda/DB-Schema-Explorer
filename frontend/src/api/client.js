const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Request failed');
  }
  return res.json();
}

export function connectDb(credentials) {
  return request('/connect', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
}

export function extractSchema(sessionId) {
  return request(`/schema/${sessionId}`);
}

export function textToSql(sessionId, question) {
  return request('/text-to-sql', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId, question }),
  });
}

export function executeSql(sessionId, sql) {
  return request('/execute-sql', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId, sql }),
  });
}

export function disconnect(sessionId) {
  return request(`/disconnect/${sessionId}`, { method: 'POST' });
}
