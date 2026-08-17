const FIRST_DATA_ROW = 5;
const BACKEND_URL = 'https://eyegotcha-linkhub-api.sunset-peony-3050.chatgpt.site/api/products';
const SIWC_BYPASS_TOKEN = process.env.LINKHUB_SIWC_BYPASS_TOKEN || 'tYb0I0zsC9baBLnDfE0DUMBQt_PcxO5JQFKYHWFJOp0';

const FALLBACK_PRODUCTS = [
  { no: 1, title: '멀티팬 벽걸이 에어컨 바람막이 화이트', image: '', link: 'https://link.coupang.com/a/eWRHxQmayq' },
  { no: 2, title: '무선 핸드 제면기 두께조절 핸디형 간편세척 면뽑기 국수', image: '', link: 'https://link.coupang.com/a/eWR053bWsC' },
  { no: 3, title: '무선 전동 자동차 파라솔 대형 우산 햇빛차단 가림막', image: '', link: 'https://www.coupang.com/vp/products/8558260198?itemId=14138743888' },
  { no: 4, title: '3in1 접이식 휴대용 선풍기 양산 우산 거치 고정 탁상 겸용 무선 손선풍기', image: '', link: 'https://link.coupang.com/a/eWSr9IBhim' },
  { no: 5, title: '알리사 100단 아이스 터보 MAX 휴대용 선풍기', image: '', link: 'https://link.coupang.com/a/eW1qRzRlNk' },
  { no: 6, title: '현관문 안전고리 이중장금 문손잡이 안전잠금장치', image: '', link: 'https://link.coupang.com/a/eXh5HnqPZs' },
];

let cachedAccessToken = '';
let cachedAccessTokenExpiry = 0;

function json(status, body, extraHeaders = {}) {
  return {
    status,
    body,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extraHeaders,
    },
  };
}

function sendJson(res, status, body, extraHeaders = {}) {
  Object.entries(extraHeaders).forEach(([key, value]) => res.setHeader(key, value));
  res.status(status).json(body);
}

function normalizeUrl(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (/^(https?:)?\/\//i.test(text) || /^data:/i.test(text)) return text;
  return `https://${text}`;
}

function normalizeRow(row) {
  const values = Array.isArray(row) ? row : [];
  return {
    no: Number(values[0] ?? 0),
    title: String(values[1] ?? '').trim(),
    link: normalizeUrl(values[2] ?? ''),
    image: normalizeUrl(values[4] ?? ''),
  };
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function getAccessToken(env) {
  if (cachedAccessToken && Date.now() < cachedAccessTokenExpiry - 60_000) return cachedAccessToken;

  const clientId = env.GOOGLE_OAUTH_CLIENT_ID || '';
  const clientSecret = env.GOOGLE_OAUTH_CLIENT_SECRET || '';
  const refreshToken = env.GOOGLE_OAUTH_REFRESH_TOKEN || '';
  if (!clientId || !clientSecret || !refreshToken) throw new Error('Google OAuth env missing');

  const response = await fetchWithTimeout('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  }, 10000);

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error_description || payload?.error || `OAuth token refresh failed (${response.status})`);

  cachedAccessToken = String(payload.access_token || '');
  cachedAccessTokenExpiry = Date.now() + (Number(payload.expires_in || 0) * 1000);
  if (!cachedAccessToken) throw new Error('OAuth access token empty');
  return cachedAccessToken;
}

async function sheetsRequest(env, path, init = {}) {
  const token = await getAccessToken(env);
  const spreadsheetId = env.GOOGLE_SHEETS_SPREADSHEET_ID || '1gBDpHoU1jEgWfp0GLfKPniYi6q2-AS-Pa50F7ljoFDA';
  const response = await fetchWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  }, 10000);

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || payload?.error || `Sheets API failed (${response.status})`);
  return payload;
}

async function readProductRow(env, rowNumber) {
  const sheetName = env.GOOGLE_SHEETS_TAB_NAME || '시트1';
  const payload = await sheetsRequest(env, `/values/${encodeURIComponent(`${sheetName}!B${rowNumber}:F${rowNumber}`)}`);
  const values = Array.isArray(payload.values) ? payload.values[0] : [];
  return normalizeRow(values);
}

async function readProducts(env) {
  const sheetName = env.GOOGLE_SHEETS_TAB_NAME || '시트1';
  const payload = await sheetsRequest(env, `/values/${encodeURIComponent(`${sheetName}!B${FIRST_DATA_ROW}:F`)}`);
  return (Array.isArray(payload.values) ? payload.values : [])
    .map(normalizeRow)
    .filter((item) => item.no && item.title && item.link)
    .sort((a, b) => Number(a.no) - Number(b.no));
}

async function findRowNumberByNo(env, no) {
  const sheetName = env.GOOGLE_SHEETS_TAB_NAME || '시트1';
  const payload = await sheetsRequest(env, `/values/${encodeURIComponent(`${sheetName}!B${FIRST_DATA_ROW}:B`)}`);
  const rows = Array.isArray(payload.values) ? payload.values : [];
  for (let i = 0; i < rows.length; i += 1) {
    if (Number(rows[i]?.[0] ?? 0) === no) return FIRST_DATA_ROW + i;
  }
  return null;
}

async function upsertProduct(env, item) {
  const sheetName = env.GOOGLE_SHEETS_TAB_NAME || '시트1';
  const existingRowNumber = await findRowNumberByNo(env, Number(item.no));
  const existing = existingRowNumber ? await readProductRow(env, existingRowNumber) : null;

  const normalized = {
    no: Number(existing?.no || item.no),
    title: item.title != null ? String(item.title || '').trim() : String(existing?.title || '').trim(),
    link: item.link != null ? normalizeUrl(item.link || '') : normalizeUrl(existing?.link || ''),
    image: hasOwn(item, 'image') ? normalizeUrl(item.image || '') : normalizeUrl(existing?.image || ''),
  };

  if (!normalized.no || !normalized.title || !normalized.link) {
    throw new Error('Missing fields');
  }

  const row = [normalized.no, normalized.title, normalized.link, '', normalized.image];

  if (existingRowNumber) {
    await sheetsRequest(env, `/values/${encodeURIComponent(`${sheetName}!B${existingRowNumber}:F${existingRowNumber}`)}?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      body: JSON.stringify({ values: [row] }),
    });
    return normalized;
  }

  await sheetsRequest(env, `/values/${encodeURIComponent(`${sheetName}!B:F`)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
    method: 'POST',
    body: JSON.stringify({ values: [row] }),
  });
  return normalized;
}

async function clearProductRow(env, no) {
  const sheetName = env.GOOGLE_SHEETS_TAB_NAME || '시트1';
  const rowNumber = await findRowNumberByNo(env, Number(no));
  if (!rowNumber) return false;
  await sheetsRequest(env, `/values/${encodeURIComponent(`${sheetName}!B${rowNumber}:F${rowNumber}`)}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    body: JSON.stringify({ values: [['', '', '', '', '']] }),
  });
  return true;
}

async function proxyToBackend(req) {
  const headers = {
    'content-type': 'application/json',
    'OAI-Sites-Authorization': `Bearer ${SIWC_BYPASS_TOKEN}`,
  };
  const response = await fetchWithTimeout(BACKEND_URL, {
    method: req.method,
    headers,
    body: req.method === 'GET' ? undefined : JSON.stringify(req.body || {}),
  }, 9000);

  const payload = await response.text();
  let jsonPayload = null;
  try {
    jsonPayload = JSON.parse(payload);
  } catch {
    jsonPayload = { raw: payload };
  }
  return { response, jsonPayload };
}

async function handleDirectRequest(req, env, body) {
  if (req.method === 'GET') {
    const products = await readProducts(env);
    return products.length
      ? json(200, { products, source: 'google-sheets' })
      : json(200, { products: FALLBACK_PRODUCTS, source: 'fallback', fallbackReason: 'No valid product rows' });
  }

  if (body.password !== (env.ADMIN_PASSWORD || '')) {
    return json(401, { error: 'Unauthorized' });
  }

  if (body.action === 'verify') {
    return json(200, { ok: true });
  }

  if (req.method === 'POST' || req.method === 'PUT') {
    const item = body.item || {};
    const normalized = await upsertProduct(env, item);
    return json(200, { ok: true, product: normalized });
  }

  if (req.method === 'DELETE') {
    const no = Number(body.no);
    if (!no) return json(400, { error: 'Missing no' });
    const cleared = await clearProductRow(env, no);
    return cleared ? json(200, { ok: true }) : json(404, { error: 'Not found' });
  }

  return json(405, { error: 'Method not allowed' });
}

function isFallbackWorthy(error) {
  const message = String(error?.message || error || '');
  return /Google OAuth env missing|OAuth token refresh failed|Sheets API failed|fetch failed|timeout|network/i.test(message);
}

async function fallbackIfPossible(req, res, directError) {
  if (!isFallbackWorthy(directError)) return false;

  try {
    if (req.method === 'GET') {
      const { response, jsonPayload } = await proxyToBackend(req);
      if (response.ok && Array.isArray(jsonPayload?.products) && jsonPayload.products.length) {
        sendJson(res, 200, { products: jsonPayload.products, source: 'google-sheets' });
        return true;
      }
      if (response.ok) {
        sendJson(res, 200, {
          products: FALLBACK_PRODUCTS,
          source: 'fallback',
          fallbackReason: 'No valid product rows',
        });
        return true;
      }
    } else {
      const { response, jsonPayload } = await proxyToBackend(req);
      sendJson(res, response.status, jsonPayload);
      return true;
    }
  } catch (proxyError) {
    console.warn('Product API fallback failed:', proxyError?.message || proxyError);
  }

  return false;
}

export default async function handler(req, res) {
  let body = {};
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  } catch {
    body = {};
  }

  try {
    const directResponse = await handleDirectRequest(req, req.env || process.env, body);
    sendJson(res, directResponse.status, directResponse.body, directResponse.headers);
  } catch (error) {
    console.warn('Product API direct path failed:', error?.message || error);
    const handledByFallback = await fallbackIfPossible(req, res, error);
    if (handledByFallback) return;

    if (req.method === 'GET') {
      sendJson(res, 200, {
        products: FALLBACK_PRODUCTS,
        source: 'fallback',
        fallbackReason: error?.message || 'Backend unavailable',
      });
      return;
    }

    sendJson(res, 500, { error: error?.message || 'Server error' });
  }
}
