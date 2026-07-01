export default async function handler(req, res) {
  try {
    const url = req.query?.url;
    if (!url || typeof url !== 'string') {
      res.status(400).json({ error: 'Missing url' });
      return;
    }

    const fetchWithFallback = async (targetUrl) => {
      const response = await fetch(targetUrl, {
        redirect: 'follow',
        headers: {
          'user-agent': 'Mozilla/5.0 (compatible; OpenClaw/1.0)',
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });
      if (!response.ok) return null;
      return response.text();
    };

    let html = await fetchWithFallback(url);
    if (!html) {
      const proxied = `https://r.jina.ai/http://${url.replace(/^https?:\/\//i, '')}`;
      html = await fetchWithFallback(proxied);
    }

    if (!html) {
      res.status(200).json({ imageUrl: null, source: 'fetch-failed' });
      return;
    }

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

    const candidates = found
      .map(({ url: candidateUrl, score }) => {
        const normalized = candidateUrl.startsWith('//') ? `https:${candidateUrl}` : candidateUrl;
        const lower = normalized.toLowerCase();
        const finalScore = score + (isBlocked(lower) ? -100 : 0) + (isProductish(lower) ? 12 : 0) + getSizeScore(lower);
        return { url: normalized, score: finalScore };
      })
      .filter((item) => !isBlocked(item.url))
      .sort((a, b) => b.score - a.score);

    const imageUrl = candidates[0]?.url || null;
    res.status(200).json({ imageUrl, source: imageUrl ? 'candidate' : 'not-found', candidates: candidates.slice(0, 10) });
  } catch (error) {
    res.status(200).json({ imageUrl: null, source: 'error', message: error?.message || 'unknown' });
  }
}
