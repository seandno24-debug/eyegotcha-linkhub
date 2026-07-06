let ADMIN_PASSWORD = '';

const adminGate = document.getElementById('adminGate');
const adminPanel = document.getElementById('adminPanel');
const adminPassword = document.getElementById('adminPassword');
const adminLoginBtn = document.getElementById('adminLoginBtn');
const adminGateError = document.getElementById('adminGateError');
const adminList = document.getElementById('adminList');
const saveItemBtn = document.getElementById('saveItemBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const autofillThumbBtn = document.getElementById('autofillThumbBtn');
const autofillStatus = document.getElementById('autofillStatus');
const itemImageAlbum = document.getElementById('itemImageAlbum');
const imageUploadPreviewWrap = document.getElementById('imageUploadPreviewWrap');
const imageUploadPreview = document.getElementById('imageUploadPreview');
const formTitle = document.getElementById('formTitle');
const itemNo = document.getElementById('itemNo');
const itemTitle = document.getElementById('itemTitle');
const itemImage = document.getElementById('itemImage');
const itemLink = document.getElementById('itemLink');
function normalizeUrl(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (/^(https?:)?\/\//i.test(text) || /^data:/i.test(text)) return text;
  return `https://${text}`;
}

const seedProducts = [
  { no: 1, title: '멀티팬 벽걸이 에어컨 바람막이 화이트', image: '', link: 'https://link.coupang.com/a/eWRHxQmayq' },
  { no: 2, title: '무선 핸드 제면기 두께조절 핸디형 간편세척 면뽑기 국수', image: '', link: 'https://link.coupang.com/a/eWR053bWsC' },
  { no: 3, title: '무선 전동 자동차 파라솔 대형 우산 햇빛차단 가림막', image: '', link: 'https://www.coupang.com/vp/products/8558260198?itemId=14138743888' },
  { no: 4, title: '3in1 접이식 휴대용 선풍기 양산 우산 거치 고정 탁상 겸용 무선 손선풍기', image: '', link: 'https://link.coupang.com/a/eWSr9IBhim' },
  { no: 5, title: '알리사 100단 아이스 터보 MAX 휴대용 선풍기', image: '', link: 'https://link.coupang.com/a/eW1qRzRlNk' },
  { no: 6, title: '현관문 안전고리 이중장금 문손잡이 안전잠금장치', image: '', link: 'https://link.coupang.com/a/eXh5HnqPZs' },
];

let products = loadProducts();
let editingNo = null;
let imageBackfillRunning = false;

function loadProducts() {
  return [...seedProducts];
}

async function fetchProducts() {
  const response = await fetch('/api/products', { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  return Array.isArray(payload?.products) ? payload.products : [];
}

async function persistProducts() {
  // no-op: writes now go through saveProductToApi/deleteProductFromApi
}

async function saveProductToApi(item) {
  const response = await fetch('/api/products', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: ADMIN_PASSWORD, item }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
  return payload?.product || item;
}

async function deleteProductFromApi(no) {
  const response = await fetch('/api/products', {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: ADMIN_PASSWORD, no }),
  });
  if (!response.ok) throw new Error((await response.json().catch(() => ({})))?.error || `HTTP ${response.status}`);
}

function setAutofillStatus(text, visible = true) {
  autofillStatus.textContent = text;
  autofillStatus.hidden = !visible;
}

function resetForm() {
  editingNo = null;
  formTitle.textContent = '상품 추가';
  saveItemBtn.textContent = '추가';
  cancelEditBtn.classList.add('hidden');
  itemNo.value = '';
  itemTitle.value = '';
  itemImage.value = '';
  itemLink.value = '';
  itemImageAlbum.value = '';
  imageUploadPreviewWrap.classList.add('hidden');
  imageUploadPreview.removeAttribute('src');
}

function startEdit(product) {
  editingNo = product.no;
  formTitle.textContent = `상품 수정 - NO. ${String(product.no).padStart(2, '0')}`;
  saveItemBtn.textContent = '수정 저장';
  cancelEditBtn.classList.remove('hidden');
  itemNo.value = product.no;
  itemTitle.value = product.title;
  itemImage.value = product.image || '';
  itemLink.value = product.link;
  itemImageAlbum.value = '';
  imageUploadPreviewWrap.classList.toggle('hidden', !product.image);
  if (product.image) imageUploadPreview.src = product.image;
  itemNo.focus();
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('파일을 읽을 수 없습니다.'));
    reader.readAsDataURL(file);
  });
}

const MAX_THUMB_DIMENSION = 240;
const THUMB_JPEG_QUALITY = 0.7;

function loadImageElement(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('이미지를 디코딩할 수 없습니다.'));
    img.src = dataUrl;
  });
}

async function fileToResizedDataUrl(file, maxDimension = MAX_THUMB_DIMENSION, quality = THUMB_JPEG_QUALITY) {
  const originalDataUrl = await fileToDataUrl(file);
  try {
    const img = await loadImageElement(originalDataUrl);
    const scale = Math.min(1, maxDimension / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);

    const resizedDataUrl = canvas.toDataURL('image/jpeg', quality);
    // 만약 리사이즈 결과가 원본보다 더 크면(이미 작은 이미지 등) 원본 그대로 사용
    return resizedDataUrl.length < originalDataUrl.length ? resizedDataUrl : originalDataUrl;
  } catch (error) {
    console.warn('이미지 리사이즈 실패, 원본 사용:', error);
    return originalDataUrl;
  }
}

function renderList() {
  const sorted = [...products].sort((a, b) => Number(a.no) - Number(b.no));
  adminList.innerHTML = sorted.map((product) => `
    <article class="admin-item">
      <div>
        <span class="card-number">NO. ${String(product.no).padStart(2, '0')}</span>
        <strong>${product.title}</strong>
        <p><a href="${product.link}" target="_blank" rel="noopener noreferrer" class="admin-link">${product.link}</a></p>
        ${product.image
          ? `<div class="admin-image-meta"><img src="${product.image}" alt="썸네일 미리보기" class="admin-image-thumb" /><p class="admin-muted">이미지 등록됨</p></div>`
          : '<p class="admin-muted">IMG: 없음</p>'}
      </div>
      <div class="admin-item-actions">
        <button type="button" data-edit="${product.no}">수정</button>
        <button type="button" class="danger" data-delete="${product.no}">삭제</button>
      </div>
    </article>
  `).join('');

  adminList.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const no = Number(btn.dataset.edit);
      const product = products.find((item) => Number(item.no) === no);
      if (product) startEdit(product);
    });
  });

  adminList.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const no = Number(btn.dataset.delete);
      if (!confirm(`NO. ${String(no).padStart(2, '0')}을(를) 삭제할까요?`)) return;
      try {
        await deleteProductFromApi(no);
        products = products.filter((item) => Number(item.no) !== no);
        renderList();
        resetForm();
      } catch (error) {
        alert(`삭제 실패: ${error.message}`);
      }
    });
  });
}

async function submitItem() {
  const next = {
    no: Number(itemNo.value),
    title: itemTitle.value.trim(),
    image: normalizeUrl(itemImage.value),
    link: normalizeUrl(itemLink.value),
  };

  if (!next.no || !next.title || !next.link) {
    alert('번호, 상품명, 쿠팡 링크는 필수입니다.');
    return;
  }

  const existsIndex = products.findIndex((item) => Number(item.no) === next.no);

  if (editingNo === null && existsIndex >= 0) {
    if (!confirm(`NO. ${String(next.no).padStart(2, '0')}는 이미 있습니다. 덮어쓸까요?`)) return;
  }

  try {
    const saved = await saveProductToApi(next);
    next.image = normalizeUrl(saved.image || next.image);
  } catch (error) {
    alert(`저장 실패: ${error.message}`);
    return;
  }

  if (editingNo !== null) {
    products = products.map((item) => Number(item.no) === Number(editingNo) ? next : item);
  } else if (existsIndex >= 0) {
    products[existsIndex] = next;
  } else {
    products.push(next);
  }

  renderList();
  resetForm();
}

async function autofillThumb() {
  const link = normalizeUrl(itemLink.value);
  if (!link) {
    alert('먼저 쿠팡 링크를 입력해줘.');
    return;
  }

  setAutofillStatus('썸네일을 가져오는 중...', true);
  autofillThumbBtn.disabled = true;

  try {
    const response = await fetch(`/api/coupang-image?url=${encodeURIComponent(link)}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (!payload?.imageUrl) throw new Error('이미지를 찾지 못했어');
    if (/logo|icon|favicon|badge|banner|coupon/i.test(String(payload.imageUrl))) {
      throw new Error('아이콘성 이미지가 잡혔어');
    }
    itemImage.value = payload.imageUrl;
    imageUploadPreview.src = payload.imageUrl;
    imageUploadPreviewWrap.classList.remove('hidden');
    setAutofillStatus('썸네일 주소를 자동으로 채웠어.', true);
  } catch (error) {
    console.warn(error);
    setAutofillStatus('썸네일 자동 채우기에 실패했어. 링크를 다시 확인해줘.', true);
  } finally {
    autofillThumbBtn.disabled = false;
  }
}

async function autofillThumbForProduct(product) {
  const link = normalizeUrl(product.link);
  if (!link || String(product.image || '').trim()) return product;

  try {
    const response = await fetch(`/api/coupang-image?url=${encodeURIComponent(link)}`, { cache: 'no-store' });
    if (!response.ok) return product;
    const payload = await response.json();
    if (!payload?.imageUrl) return product;
    const imageUrl = normalizeUrl(payload.imageUrl);
    if (/logo|icon|favicon|badge|banner|coupon/i.test(String(imageUrl))) return product;
    return { ...product, image: imageUrl };
  } catch (error) {
    console.warn(error);
    return product;
  }
}

async function backfillMissingImages() {
  if (imageBackfillRunning) return;
  imageBackfillRunning = true;
  try {
    let changed = false;
    const sorted = [...products].sort((a, b) => Number(a.no) - Number(b.no));
    const nextProducts = [];
    for (const product of sorted) {
      const next = await autofillThumbForProduct(product);
      if (next.image && next.image !== product.image) changed = true;
      nextProducts.push(next);
    }
    if (changed) {
      products = nextProducts;
      for (const product of nextProducts) {
        try { await saveProductToApi(product); } catch (error) { console.warn(error); }
      }
      renderList();
      setAutofillStatus('비어 있던 썸네일을 자동으로 채웠어.', true);
    }
  } finally {
    imageBackfillRunning = false;
  }
}

async function handleImageFileInput(input) {
  const file = input.files?.[0];
  if (!file) {
    imageUploadPreviewWrap.classList.add('hidden');
    imageUploadPreview.removeAttribute('src');
    return;
  }

  try {
    setAutofillStatus('이미지를 최적화하는 중...', true);
    const dataUrl = await fileToResizedDataUrl(file);
    itemImage.value = dataUrl;
    imageUploadPreview.src = dataUrl;
    imageUploadPreviewWrap.classList.remove('hidden');
    setAutofillStatus('업로드한 이미지를 썸네일 주소로 반영했어 (자동 최적화됨).', true);
  } catch (error) {
    console.warn(error);
    alert('이미지를 읽지 못했어. 다른 파일로 다시 시도해줘.');
  }
}

itemImageAlbum.addEventListener('change', async () => {
  await handleImageFileInput(itemImageAlbum);
});

async function login() {
  const candidate = adminPassword.value;
  try {
    const response = await fetch('/api/products', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: candidate, action: 'verify' }),
    });
    if (!response.ok) throw new Error('bad password');
    ADMIN_PASSWORD = candidate;
    adminGate.classList.add('hidden');
    adminPanel.classList.remove('hidden');
    adminGateError.hidden = true;
    products = await fetchProducts();
    renderList();
    backfillMissingImages();
  } catch (error) {
    adminGateError.hidden = false;
  }
}

adminLoginBtn.addEventListener('click', login);
adminPassword.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') login();
});

saveItemBtn.addEventListener('click', submitItem);
cancelEditBtn.addEventListener('click', resetForm);
autofillThumbBtn.addEventListener('click', autofillThumb);

resetForm();
