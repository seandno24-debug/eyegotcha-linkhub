const FIRST_DATA_ROW = 5;
let cachedAccessToken = '';
let cachedAccessTokenExpiry = 0;

const FALLBACK_PRODUCTS = [
  { no: 1, title: '멀티팬 벽걸이 에어컨 바람막이 화이트', image: '', link: 'https://link.coupang.com/a/eWRHxQmayq' },
  { no: 2, title: '무선 핸드 제면기 두께조절 핸디형 간편세척 면뽑기 국수', image: '', link: 'https://link.coupang.com/a/eWR053bWsC' },
  { no: 3, title: '무선 전동 자동차 파라솔 대형 우산 햇빛차단 가림막', image: '', link: 'https://www.coupang.com/vp/products/8558260198?itemId=14138743888' },
  { no: 4, title: '3in1 접이식 휴대용 선풍기 양산 우산 거치 고정 탁상 겸용 무선 손선풍기', image: '', link: 'https://link.coupang.com/a/eWSr9IBhim' },
  { no: 5, title: '알리사 100단 아이스 터보 MAX 휴대용 선풍기', image: '', link: 'https://link.coupang.com/a/eW1qRzRlNk' },
  { no: 6, title: '현관문 안전고리 이중장금 문손잡이 안전잠금장치', image: '', link: 'https://link.coupang.com/a/eXh5HnqPZs' },
];

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
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

async function getAccessToken(env) {
  if (cachedAccessToken && Date.now() < cachedAccessTokenExpiry - 60_000) return cachedAccessToken;

  const clientId = env.GOOGLE_OAUTH_CLIENT_ID || '';
  const clientSecret = env.GOOGLE_OAUTH_CLIENT_SECRET || '';
  const refreshToken = env.GOOGLE_OAUTH_REFRESH_TOKEN || '';
  if (!clientId || !clientSecret || !refreshToken) throw new Error('Google OAuth env missing');

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

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
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || payload?.error || `Sheets API failed (${response.status})`);
  return payload;
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
  const row = [Number(item.no), String(item.title || '').trim(), normalizeUrl(item.link || ''), '', normalizeUrl(item.image || '')];
  const existingRowNumber = await findRowNumberByNo(env, Number(item.no));
  if (existingRowNumber) {
    await sheetsRequest(env, `/values/${encodeURIComponent(`${sheetName}!B${existingRowNumber}:F${existingRowNumber}`)}?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      body: JSON.stringify({ values: [row] }),
    });
  } else {
    await sheetsRequest(env, `/values/${encodeURIComponent(`${sheetName}!B:F`)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
      method: 'POST',
      body: JSON.stringify({ values: [row] }),
    });
  }
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

async function handleProducts(request, env) {
  if (request.method === 'GET') {
    const products = await readProducts(env);
    return products.length
      ? json({ products, source: 'google-sheets' })
      : json({ products: FALLBACK_PRODUCTS, source: 'fallback', fallbackReason: 'No valid product rows' });
  }

  const body = await request.json().catch(() => ({}));
  if (body.password !== (env.ADMIN_PASSWORD || '')) return json({ error: 'Unauthorized' }, 401);
  if (body.action === 'verify') return json({ ok: true });

  if (request.method === 'POST' || request.method === 'PUT') {
    const item = body.item || {};
    const normalized = {
      no: Number(item.no),
      title: String(item.title || '').trim(),
      link: normalizeUrl(item.link || ''),
      image: normalizeUrl(item.image || ''),
    };
    if (!normalized.no || !normalized.title || !normalized.link) return json({ error: 'Missing fields' }, 400);
    await upsertProduct(env, normalized);
    return json({ ok: true, product: normalized });
  }

  if (request.method === 'DELETE') {
    const no = Number(body.no);
    if (!no) return json({ error: 'Missing no' }, 400);
    const cleared = await clearProductRow(env, no);
    return cleared ? json({ ok: true }) : json({ error: 'Not found' }, 404);
  }

  return json({ error: 'Method not allowed' }, 405);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/products') return handleProducts(request, env);
    return json({ ok: true, service: 'eyegotcha-linkhub-api' });
  },
};
