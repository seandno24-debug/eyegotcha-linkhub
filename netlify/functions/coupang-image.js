exports.handler = async (event) => {
  try {
    const url = event.queryStringParameters?.url;
    if (!url || typeof url !== 'string') {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ error: 'Missing url' }),
      };
    }

    const response = await fetch(url, {
      redirect: 'follow',
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; OpenClaw/1.0)',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ imageUrl: null, source: 'fetch-failed', status: response.status }),
      };
    }

    const html = await response.text();
    const candidates = [];

    const pushMatch = (value) => {
      if (!value) return;
      const cleaned = String(value).trim();
      if (!cleaned) return;
      candidates.push(cleaned);
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
      while ((match = re.exec(html))) pushMatch(match[1]);
    }

    let imageUrl = null;
    for (const candidate of candidates) {
      const normalized = candidate.startsWith('//') ? `https:${candidate}` : candidate;
      const lower = normalized.toLowerCase();
      const looksLikeLogo = /logo|sprite|icon|favicon|brand/.test(lower);
      const looksLikeImage = /\.(jpg|jpeg|png|webp|gif)(\?|#|$)/.test(lower) || /img|image|photo|thumb/.test(lower);
      if (looksLikeImage && !looksLikeLogo) {
        imageUrl = normalized;
        break;
      }
    }

    if (!imageUrl) {
      imageUrl = candidates.find((url) => !/logo|sprite|icon|favicon|brand/i.test(url)) || null;
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ imageUrl, source: imageUrl ? 'candidate' : 'not-found', candidates: candidates.slice(0, 10) }),
    };
  } catch (error) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ imageUrl: null, source: 'error', message: error?.message || 'unknown' }),
    };
  }
};
