export default async function handler(req, res) {
  try {
    const url = req.query?.url;
    if (!url || typeof url !== 'string') {
      res.status(400).json({ error: 'Missing url' });
      return;
    }

    const response = await fetch(url, {
      redirect: 'follow',
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; OpenClaw/1.0)',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      res.status(200).json({ imageUrl: null, source: 'fetch-failed', status: response.status });
      return;
    }

    const html = await response.text();
    const candidates = [];
    const push = (value) => {
      if (!value) return;
      const cleaned = String(value).trim();
      if (cleaned) candidates.push(cleaned);
    };

    const regexes = [
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/ig,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/ig,
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/ig,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/ig,
      /<img[^>]+src=["']([^"']+)["'][^>]*(?:product|item|detail|thumb|image)[^>]*>/ig,
      /"image"\s*:\s*"([^"]+)"/ig,
      /"imageUrl"\s*:\s*"([^"]+)"/ig,
      /"thumbnailUrl"\s*:\s*"([^"]+)"/ig,
    ];

    for (const re of regexes) {
      let match;
      while ((match = re.exec(html))) push(match[1]);
    }

    const isBlocked = (urlText) => /logo|sprite|icon|favicon|brand|coupon|badge|promo|banner/i.test(urlText);
    const isProbablyProduct = (urlText) => {
      const lower = urlText.toLowerCase();
      return /(jpg|jpeg|png|webp|gif)(\?|#|$)/.test(lower) || /img|image|photo|thumb|item|product/.test(lower);
    };

    let imageUrl = null;
    for (const candidate of candidates) {
      const normalized = candidate.startsWith('//') ? `https:${candidate}` : candidate;
      if (isBlocked(normalized)) continue;
      if (!isProbablyProduct(normalized)) continue;
      imageUrl = normalized;
      break;
    }

    res.status(200).json({ imageUrl, source: imageUrl ? 'candidate' : 'not-found', candidates: candidates.slice(0, 10) });
  } catch (error) {
    res.status(200).json({ imageUrl: null, source: 'error', message: error?.message || 'unknown' });
  }
}
