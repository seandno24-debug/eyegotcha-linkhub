import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const hasSupabaseConfig = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
const supabase = hasSupabaseConfig
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;
const STORAGE_BUCKET = process.env.PRODUCT_IMAGES_BUCKET || 'product-images';
const SEED_PRODUCTS = [
  { no: 1, title: '멀티팬 벽걸이 에어컨 바람막이 화이트', image: '', link: 'https://link.coupang.com/a/eWRHxQmayq' },
  { no: 2, title: '무선 핸드 제면기 두께조절 핸디형 간편세척 면뽑기 국수', image: '', link: 'https://link.coupang.com/a/eWR053bWsC' },
  { no: 3, title: '무선 전동 자동차 파라솔 대형 우산 햇빛차단 가림막', image: '', link: 'https://www.coupang.com/vp/products/8558260198?itemId=14138743888' },
  { no: 4, title: '3in1 접이식 휴대용 선풍기 양산 우산 거치 고정 탁상 겸용 무선 손선풍기', image: '', link: 'https://link.coupang.com/a/eWSr9IBhim' },
  { no: 5, title: '알리사 100단 아이스 터보 MAX 휴대용 선풍기', image: '', link: 'https://link.coupang.com/a/eW1qRzRlNk' },
  { no: 6, title: '현관문 안전고리 이중장금 문손잡이 안전잠금장치', image: '', link: 'https://link.coupang.com/a/eXh5HnqPZs' },
];

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_FAILS = 5;
const failedAttemptsByIp = new Map();

function getClientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

function cleanupExpiredAttempts(now = Date.now()) {
  for (const [ip, record] of failedAttemptsByIp.entries()) {
    if (!record || now - record.firstSeen > RATE_LIMIT_WINDOW_MS) {
      failedAttemptsByIp.delete(ip);
    }
  }
}

function registerFailedAttempt(ip) {
  const now = Date.now();
  cleanupExpiredAttempts(now);
  const record = failedAttemptsByIp.get(ip) || { count: 0, firstSeen: now };
  if (now - record.firstSeen > RATE_LIMIT_WINDOW_MS) {
    record.count = 0;
    record.firstSeen = now;
  }
  record.count += 1;
  failedAttemptsByIp.set(ip, record);
  return record;
}

function isRateLimited(ip) {
  const now = Date.now();
  cleanupExpiredAttempts(now);
  const record = failedAttemptsByIp.get(ip);
  if (!record) return false;
  if (now - record.firstSeen > RATE_LIMIT_WINDOW_MS) {
    failedAttemptsByIp.delete(ip);
    return false;
  }
  return record.count >= RATE_LIMIT_MAX_FAILS;
}

function rateLimitResponse(res, ip, record) {
  const retryAfterSeconds = Math.max(1, Math.ceil((RATE_LIMIT_WINDOW_MS - (Date.now() - record.firstSeen)) / 1000));
  res.setHeader('Retry-After', String(retryAfterSeconds));
  res.status(429).json({ error: 'Too many login attempts', retryAfterSeconds, ip });
}

function parseDataUrl(dataUrl) {
  const match = String(dataUrl || '').match(/^data:([^;,]+)?(?:;charset=[^;,]+)?(;base64)?,(.*)$/s);
  if (!match) return null;
  const mimeType = match[1] || 'image/jpeg';
  const isBase64 = Boolean(match[2]);
  const body = match[3] || '';
  const buffer = isBase64
    ? Buffer.from(body, 'base64')
    : Buffer.from(decodeURIComponent(body), 'utf8');
  return { mimeType, buffer };
}

function extFromMime(mimeType) {
  const normalized = String(mimeType || '').toLowerCase();
  if (normalized.includes('png')) return 'png';
  if (normalized.includes('webp')) return 'webp';
  if (normalized.includes('gif')) return 'gif';
  if (normalized.includes('avif')) return 'avif';
  return 'jpg';
}

async function uploadDataUrlToStorage(dataUrl, no) {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed?.buffer?.length) throw new Error('Invalid data URL');

  const filePath = `products/no-${String(no).padStart(4, '0')}.${extFromMime(parsed.mimeType)}`;
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(filePath, parsed.buffer, {
    upsert: true,
    cacheControl: '3600',
    contentType: parsed.mimeType || 'image/jpeg',
  });
  if (error) throw error;

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);
  return data?.publicUrl || dataUrl;
}

async function normalizeImageForStorage(image, no) {
  const text = String(image || '').trim();
  if (!text) return '';
  if (!/^data:/i.test(text)) return text;

  try {
    return await uploadDataUrlToStorage(text, no);
  } catch (error) {
    console.warn('Storage upload failed, keeping original data URL:', error?.message || error);
    return text;
  }
}

function respondWithFallbackProducts(res, error) {
  if (error) console.warn('Falling back to seed products:', error?.message || error);
  res.setHeader('Cache-Control', 'public, max-age=10, s-maxage=30, stale-while-revalidate=60');
  res.setHeader('Vary', 'Accept-Encoding');
  res.status(200).json({
    products: SEED_PRODUCTS,
    source: 'fallback',
    fallbackReason: error?.message || 'Supabase unavailable',
  });
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      if (!hasSupabaseConfig) {
        respondWithFallbackProducts(res);
        return;
      }

      let data = [];
      try {
        const result = await supabase.from('products').select('*').order('no', { ascending: true });
        if (result?.error) throw result.error;
        data = Array.isArray(result?.data) ? result.data : [];
      } catch (error) {
        respondWithFallbackProducts(res, error);
        return;
      }

      res.setHeader('Cache-Control', 'public, max-age=10, s-maxage=30, stale-while-revalidate=60');
      res.setHeader('Vary', 'Accept-Encoding');
      res.status(200).json({ products: data, source: 'supabase' });
      return;
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const ip = getClientIp(req);

    if (isRateLimited(ip)) {
      rateLimitResponse(res, ip, failedAttemptsByIp.get(ip));
      return;
    }

    if (!hasSupabaseConfig) {
      res.status(503).json({ error: 'Supabase 환경변수가 설정되지 않았어요' });
      return;
    }

    if (body.password !== process.env.ADMIN_PASSWORD) {
      const record = registerFailedAttempt(ip);
      if (record.count >= RATE_LIMIT_MAX_FAILS) {
        rateLimitResponse(res, ip, record);
        return;
      }
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    failedAttemptsByIp.delete(ip);

    if (body.action === 'verify') {
      res.status(200).json({ ok: true });
      return;
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      const item = body.item || {};
      const row = {
        no: Number(item.no),
        title: String(item.title || '').trim(),
        image: await normalizeImageForStorage(item.image || '', Number(item.no)),
        link: String(item.link || '').trim(),
      };
      if (!row.no || !row.title || !row.link) {
        res.status(400).json({ error: 'Missing fields' });
        return;
      }
      const { error } = await supabase.from('products').upsert(row, { onConflict: 'no' });
      if (error) throw error;
      res.status(200).json({ ok: true, product: row });
      return;
    }

    if (req.method === 'DELETE') {
      const no = Number(body.no);
      if (!no) {
        res.status(400).json({ error: 'Missing no' });
        return;
      }
      const { error } = await supabase.from('products').delete().eq('no', no);
      if (error) throw error;
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    res.status(500).json({ error: error?.message || 'Server error' });
  }
}
