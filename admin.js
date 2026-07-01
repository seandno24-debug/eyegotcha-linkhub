const ADMIN_PASSWORD = '901224';
const STORAGE_KEY = 'seandino_linkhub_admin_products_v1';

const adminGate = document.getElementById('adminGate');
const adminPanel = document.getElementById('adminPanel');
const adminPassword = document.getElementById('adminPassword');
const adminLoginBtn = document.getElementById('adminLoginBtn');
const adminGateError = document.getElementById('adminGateError');
const adminList = document.getElementById('adminList');
const saveItemBtn = document.getElementById('saveItemBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const autofillThumbBtn = document.getElementById('autofillThumbBtn');
const syncSheetBtn = document.getElementById('syncSheetBtn');
const autofillStatus = document.getElementById('autofillStatus');
const itemImageFile = document.getElementById('itemImageFile');
const imageUploadPreviewWrap = document.getElementById('imageUploadPreviewWrap');
const imageUploadPreview = document.getElementById('imageUploadPreview');
const formTitle = document.getElementById('formTitle');
const itemNo = document.getElementById('itemNo');
const itemTitle = document.getElementById('itemTitle');
const itemImage = document.getElementById('itemImage');
const itemLink = document.getElementById('itemLink');
const PUBLIC_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1gBDpHoU1jEgWfp0GLfKPniYi6q2-AS-Pa50F7ljoFDA/edit?usp=sharing';

function normalizeUrl(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (/^https?:\/\//i.test(text)) return text;
  return `https://${text}`;
}

function toSheetImageFormula(url) {
  const text = String(url ?? '').trim();
  if (!text) return '';
  if (/^=IMAGE\(/i.test(text)) return text;
  const safe = text.replace(/"/g, '""');
  return `=IMAGE("${safe}")`;
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
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...seedProducts];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...seedProducts];
    return parsed;
  } catch {
    return [...seedProducts];
  }
}

function persistProducts() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
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
  itemImageFile.value = '';
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
  itemImageFile.value = '';
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

function renderList() {
  const sorted = [...products].sort((a, b) => Number(a.no) - Number(b.no));
  adminList.innerHTML = sorted.map((product) => `
    <article class="admin-item">
      <div>
        <span class="card-number">NO. ${String(product.no).padStart(2, '0')}</span>
        <strong>${product.title}</strong>
        <p>${product.link}</p>
        ${product.image ? `<p class="admin-muted">IMG: ${product.image}</p>` : '<p class="admin-muted">IMG: 없음</p>'}
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
    btn.addEventListener('click', () => {
      const no = Number(btn.dataset.delete);
      products = products.filter((item) => Number(item.no) !== no);
      persistProducts();
      renderList();
      resetForm();
    });
  });
}

function submitItem() {
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

  if (editingNo !== null) {
    products = products.map((item) => Number(item.no) === Number(editingNo) ? next : item);
  } else if (existsIndex >= 0) {
    if (!confirm(`NO. ${String(next.no).padStart(2, '0')}는 이미 있습니다. 덮어쓸까요?`)) return;
    products[existsIndex] = next;
  } else {
    products.push(next);
  }

  persistProducts();
  renderList();
  resetForm();
}

function buildSheetRow(product) {
  return [
    product.no,
    product.title,
    toSheetImageFormula(product.image),
    product.link,
  ];
}

async function syncToGoogleSheet() {
  const sorted = [...products].sort((a, b) => Number(a.no) - Number(b.no));
  const csv = [
    ['번호', '상품명', '이미지 주소', '쿠팡 링크'].join(','),
    ...sorted.map((product) => buildSheetRow(product).map((cell) => {
      const text = String(cell ?? '');
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    }).join(',')),
  ].join('\n');

  try {
    await navigator.clipboard.writeText(csv);
    setAutofillStatus(`시트 반영용 CSV를 복사했어. ${PUBLIC_SHEET_URL} 에 붙여넣으면 메인 화면과 맞춰질 거야.`, true);
  } catch {
    setAutofillStatus(`시트 반영용 CSV를 만들었어. ${PUBLIC_SHEET_URL} 에 직접 반영해줘.`, true);
  }
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
    itemImage.value = payload.imageUrl;
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
    return { ...product, image: normalizeUrl(payload.imageUrl) };
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
      persistProducts();
      renderList();
      setAutofillStatus('비어 있던 썸네일을 자동으로 채웠어.', true);
    }
  } finally {
    imageBackfillRunning = false;
  }
}

itemImageFile.addEventListener('change', async () => {
  const file = itemImageFile.files?.[0];
  if (!file) {
    imageUploadPreviewWrap.classList.add('hidden');
    imageUploadPreview.removeAttribute('src');
    return;
  }

  try {
    const dataUrl = await fileToDataUrl(file);
    itemImage.value = dataUrl;
    imageUploadPreview.src = dataUrl;
    imageUploadPreviewWrap.classList.remove('hidden');
    setAutofillStatus('업로드한 이미지를 썸네일 주소로 반영했어.', true);
  } catch (error) {
    console.warn(error);
    alert('이미지를 읽지 못했어. 다른 파일로 다시 시도해줘.');
  }
});

function login() {
  if (adminPassword.value === ADMIN_PASSWORD) {
    adminGate.classList.add('hidden');
    adminPanel.classList.remove('hidden');
    adminGateError.hidden = true;
    renderList();
    backfillMissingImages();
  } else {
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
syncSheetBtn.addEventListener('click', syncToGoogleSheet);

resetForm();
