function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function isAllowedCoupangUrl(url) {
  try {
    const host = new URL(url).hostname;
    return /(^|\.)coupang\.com$/i.test(host) || /(^|\.)link\.coupang\.com$/i.test(host);
  } catch {
    return false;
  }
}

async function fetchWithFallback(targetUrl, timeoutMs = 6500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);
  try {
    const response = await fetch(targetUrl, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; OpenClaw/1.0)',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    if (!response.ok) return null;
    return response.text();
  } finally {
    clearTimeout(timer);
  }
}

function extractCandidates(html) {
  const found = [];
  const push = (value, score = 0) => {
    if (!value) return;
    const cleaned = String(value).trim();
    if (!cleaned) return;
    found.push({ url: cleaned, score });
  };

  const addMetaMatches = (re, score) => {
    let match;
    while ((match = re.exec(html))) push(match[1], score);
  };

  addMetaMatches(/<meta[^>]+property=["']og:image(?:[^"']*)?["'][^>]+content=["']([^"']+)["']/ig, 80);
  addMetaMatches(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?:[^"']*)?["']/ig, 80);
  addMetaMatches(/<meta[^>]+name=["']twitter:image(?:[^"']*)?["'][^>]+content=["']([^"']+)["']/ig, 75);
  addMetaMatches(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?:[^"']*)?["']/ig, 75);
  addMetaMatches(/<meta[^>]+itemprop=["']image["'][^>]+content=["']([^"']+)["']/ig, 70);
  addMetaMatches(/"thumbnailUrl"\s*:\s*"([^"]+)"/ig, 72);
  addMetaMatches(/"imageUrl"\s*:\s*"([^"]+)"/ig, 70);
  addMetaMatches(/"image"\s*:\s*"([^"]+)"/ig, 60);
  addMetaMatches(/<img[^>]+src=["']([^"']+)["'][^>]*>/ig, 30);

  const isBlocked = (value) => /logo|sprite|icon|favicon|brand|coupon|badge|promo|banner|spacer|blank|gif|pixel|loading/i.test(value);
  const isProductish = (value) => /product|detail|thumb|item|goods|image|photo|cdn/i.test(value);
  const getSizeScore = (value) => {
    const sizeMatch = value.match(/(?:^|[?&/_-])(\d{2,4})[xX](\d{2,4})(?:$|[?&#/_-])/);
    if (!sizeMatch) return 0;
    const w = Number(sizeMatch[1]);
    const h = Number(sizeMatch[2]);
    if (Number.isNaN(w) || Number.isNaN(h)) return 0;
    return w >= 200 && h >= 200 ? 25 : -20;
  };

  return found
    .map(({ url, score }) => {
      const normalized = url.startsWith('//') ? `https:${url}` : url;
      const lower = normalized.toLowerCase();
      const finalScore = score + (isBlocked(lower) ? -100 : 0) + (isProductish(lower) ? 12 : 0) + getSizeScore(lower);
      return { url: normalized, score: finalScore };
    })
    .filter((item) => !isBlocked(item.url))
    .sort((a, b) => b.score - a.score);
}

export async function onRequest({ request }) {
  try {
    const url = new URL(request.url).searchParams.get('url');
    if (!url) return json({ error: 'Missing url' }, 400);
    if (!isAllowedCoupangUrl(url)) return json({ error: 'Only coupang.com URLs are allowed' }, 400);

    let html = await fetchWithFallback(url);
    if (!html) {
      const proxied = `https://r.jina.ai/http://${url.replace(/^https?:\/\//i, '')}`;
      html = await fetchWithFallback(proxied, 8000);
    }

    if (!html) return json({ imageUrl: null, source: 'fetch-failed' });

    const candidates = extractCandidates(html);
    const imageUrl = candidates[0]?.url || null;
    return json({ imageUrl, source: imageUrl ? 'candidate' : 'not-found', candidates: candidates.slice(0, 10) });
  } catch (error) {
    return json({ imageUrl: null, source: 'error', message: error?.message || 'unknown' });
  }
}
