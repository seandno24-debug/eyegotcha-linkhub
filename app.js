const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1gBDpHoU1jEgWfp0GLfKPniYi6q2-AS-Pa50F7ljoFDA/export?format=csv';
const ADMIN_STORAGE_KEY = 'seandino_linkhub_admin_products_v1';

const FALLBACK_PRODUCTS = [
  {
    no: 1,
    title: '멀티팬 벽걸이 에어컨 바람막이 화이트',
    link: 'https://link.coupang.com/a/eWRHxQmayq',
    image: '',
  },
  {
    no: 2,
    title: '무선 핸드 제면기 두께조절 핸디형 간편세척 면뽑기 국수',
    link: 'https://link.coupang.com/a/eWR053bWsC',
    image: '',
  },
  {
    no: 3,
    title: '무선 전동 자동차 파라솔 대형 우산 햇빛차단 가림막',
    link: 'https://www.coupang.com/vp/products/8558260198?itemId=14138743888',
    image: '',
  },
  {
    no: 4,
    title: '3in1 접이식 휴대용 선풍기 양산 우산 거치 고정 탁상 겸용 무선 손선풍기',
    link: 'https://link.coupang.com/a/eWSr9IBhim',
    image: '',
  },
  {
    no: 5,
    title: '알리사 100단 아이스 터보 MAX 휴대용 선풍기',
    link: 'https://link.coupang.com/a/eW1qRzRlNk',
    image: '',
  },
  {
    no: 6,
    title: '현관문 안전고리 이중장금 문손잡이 안전잠금장치',
    link: 'https://link.coupang.com/a/eXh5HnqPZs',
    image: '',
  },
];

const PRODUCTS = [];

function makeThumbDataUri(item) {
  const title = String(item.no).padStart(2, '0');
  const label = item.thumbLabel || 'SHOT';
  const subline = item.thumbSubline || 'thumbnail';
  const accent = item.thumbAccent;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="${accent}" stop-opacity="0.96" />
          <stop offset="100%" stop-color="#111111" stop-opacity="0.92" />
        </linearGradient>
      </defs>
      <rect width="600" height="600" rx="48" fill="url(#g)" />
      <rect x="42" y="42" width="516" height="516" rx="34" fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.16)" />
      <rect x="68" y="70" width="220" height="38" rx="19" fill="rgba(255,255,255,0.16)" />
      <text x="90" y="96" font-family="Arial, sans-serif" font-size="24" font-weight="800" fill="rgba(255,255,255,0.94)">NO. ${title}</text>
      <rect x="68" y="156" width="464" height="224" rx="28" fill="rgba(255,255,255,0.13)" stroke="rgba(255,255,255,0.16)" />
      <rect x="92" y="180" width="416" height="176" rx="22" fill="rgba(17,17,17,0.38)" />
      <circle cx="176" cy="266" r="58" fill="rgba(255,255,255,0.16)" />
      <circle cx="418" cy="262" r="34" fill="rgba(255,255,255,0.18)" />
      <text x="92" y="452" font-family="Arial, sans-serif" font-size="56" font-weight="800" fill="#ffffff">${label}</text>
      <text x="92" y="496" font-family="Arial, sans-serif" font-size="26" font-weight="600" fill="rgba(255,255,255,0.80)">${subline}</text>
      <text x="92" y="540" font-family="Arial, sans-serif" font-size="22" font-weight="600" fill="rgba(255,255,255,0.70)">Tap to open</text>
    </svg>
  `.trim();
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

const state = {
  query: '',
  loading: true,
  loadError: false,
};

const searchInput = document.getElementById('searchInput');
const productGrid = document.getElementById('productGrid');
const resultCount = document.getElementById('resultCount');
const emptyState = document.getElementById('emptyState');
const loadError = document.getElementById('loadError');
const loadingBar = document.getElementById('loadingBar');
const imageCache = new Map();
const THUMB_CACHE_KEY = 'seandino_linkhub_public_thumb_cache_v1';

function loadThumbCache() {
  try {
    const raw = localStorage.getItem(THUMB_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveThumbCache(cache) {
  try {
    localStorage.setItem(THUMB_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore storage failures
  }
}

const thumbCache = loadThumbCache();

function normalizeUrl(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (/^https?:\/\//i.test(text)) return text;
  return `https://${text}`;
}

function normalizeItem(row) {
  const no = Number(row.no ?? row.No ?? row['no.'] ?? row['번호']);
  const title = String(row['상품명'] ?? row.title ?? '').trim();
  const link = normalizeUrl(
    row['쿠팡 링크']
    ?? row['링크']
    ?? row.link
    ?? row.url
    ?? ''
  );
  const image = normalizeUrl(
    row['이미지 주소']
    ?? row['이미지']
    ?? row.image
    ?? row.image_url
    ?? row.imageUrl
    ?? ''
  );
  const cachedImage = link ? normalizeUrl(thumbCache[link] || '') : '';
  const shortTitle = title.replace(/\s+/g, ' ').slice(0, 12) || 'product';
  return {
    no,
    title,
    image: image || cachedImage,
    link,
    thumbLabel: `NO ${String(no).padStart(2, '0')}`,
    thumbSubline: shortTitle,
    thumbAccent: ['#6d5bd0', '#f97316', '#0ea5e9', '#10b981', '#eab308'][Math.max(0, (no - 1) % 5)],
  };
}

function loadAdminOverrides() {
  try {
    const raw = localStorage.getItem(ADMIN_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeItem).filter((item) => item.no && item.title && item.link);
  } catch {
    return [];
  }
}

function mergeProducts(sheetItems, adminItems) {
  const merged = new Map();
  for (const item of sheetItems) merged.set(Number(item.no), item);
  for (const item of adminItems) merged.set(Number(item.no), item);
  return [...merged.values()].sort((a, b) => Number(a.no) - Number(b.no));
}

function parseCsv(csvText) {
  const lines = csvText.split(/\r?\n/).filter(Boolean);
  const rows = [];
  let headers = [];
  for (const line of lines) {
    const cols = line.split(',').map((cell) => cell.replace(/^"|"$/g, '').trim());
    if (!headers.length) {
      headers = cols;
      continue;
    }
    if (cols.every((cell) => !cell)) continue;
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = cols[idx] ?? '';
    });
    rows.push(row);
  }
  return rows;
}

function setLoading(isLoading) {
  state.loading = isLoading;
  loadingBar.classList.toggle('hidden', !isLoading);
}

function setLoadError(show) {
  state.loadError = show;
  loadError.hidden = !show;
}

function getActiveProducts() {
  return PRODUCTS.length ? PRODUCTS : FALLBACK_PRODUCTS.map(normalizeItem);
}

function matches(item) {
  const query = state.query.trim().toLowerCase();
  if (!query) return true;
  const numericQuery = /^[0-9]+$/.test(query);
  if (numericQuery) {
    const exactNo = String(item.no) === String(Number(query));
    return exactNo;
  }
  return item.title.toLowerCase().includes(query);
}

function renderProducts() {
  const items = getActiveProducts();
  const filtered = items.filter(matches);
  emptyState.hidden = filtered.length !== 0;
  loadError.hidden = true;

  productGrid.innerHTML = filtered.map((item) => `
    <a class="product-card" href="${item.link}" target="_blank" rel="noopener noreferrer" data-product-no="${item.no}" data-product-link="${item.link}">
      <img class="thumb" src="${item.image || makeThumbDataUri(item)}" alt="${item.title} 썸네일" loading="lazy" data-thumb-for="${item.no}" />
      <div class="card-copy">
        <span class="card-number">NO. ${String(item.no).padStart(2, '0')}</span>
        <h2 class="card-title">${item.title}</h2>
      </div>
    </a>
  `).join('');

  hydrateImages(filtered);
}

async function fetchCoupangImage(link) {
  if (!link || imageCache.has(link)) return imageCache.get(link) || null;

  const apiUrl = `/api/coupang-image?url=${encodeURIComponent(link)}`;
  try {
    const response = await fetch(apiUrl, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const imageUrl = payload?.imageUrl || null;
    imageCache.set(link, imageUrl);
    return imageUrl;
  } catch (error) {
    console.warn('Image lookup failed:', error);
    imageCache.set(link, null);
    return null;
  }
}

async function hydrateImages(items) {
  await Promise.all(items.map(async (item) => {
    if (item.image) return;
    const imageUrl = await fetchCoupangImage(item.link);
    if (!imageUrl) return;
    const normalized = normalizeUrl(imageUrl);
    thumbCache[item.link] = normalized;
    saveThumbCache(thumbCache);
    const cachedItem = PRODUCTS.find((product) => Number(product.no) === Number(item.no));
    if (cachedItem) cachedItem.image = normalized;
    const img = document.querySelector(`[data-thumb-for="${CSS.escape(String(item.no))}"]`);
    if (img && img instanceof HTMLImageElement) {
      img.src = normalized;
      img.alt = `${item.title} 이미지`;
    }
  }));
}

async function loadProductsFromSheet() {
  setLoading(true);
  setLoadError(false);
  try {
    const response = await fetch(SHEET_CSV_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const csvText = await response.text();
    const rows = parseCsv(csvText);
    const dataRows = rows.filter((row) => String(row['no.'] ?? row.no ?? row['번호'] ?? '').trim());
    const sheetItems = dataRows.map(normalizeItem).filter((item) => item.no && item.title && item.link);
    const adminItems = loadAdminOverrides();
    PRODUCTS.splice(0, PRODUCTS.length, ...mergeProducts(sheetItems, adminItems));
    if (!PRODUCTS.length) throw new Error('No valid product rows');
    renderProducts();
  } catch (error) {
    console.error('Failed to load sheet data:', error);
    setLoadError(true);
    const adminItems = loadAdminOverrides();
    PRODUCTS.splice(0, PRODUCTS.length, ...mergeProducts(FALLBACK_PRODUCTS.map(normalizeItem), adminItems));
    renderProducts();
  } finally {
    setLoading(false);
  }
}

searchInput.addEventListener('input', (event) => {
  state.query = event.target.value;
  renderProducts();
});

renderProducts();
loadProductsFromSheet();
