const collabImageInput = document.getElementById('collabImageInput');
const collabImageDrop = document.getElementById('collabImageDrop');
const collabImagePreview = document.getElementById('collabImagePreview');
const collabImagePlus = document.getElementById('collabImagePlus');
const campaignTypeGroup = document.getElementById('campaignTypeGroup');
const collabSubmitBtn = document.getElementById('collabSubmitBtn');
const collabSubmitStatus = document.getElementById('collabSubmitStatus');

let selectedCampaignType = '';
let selectedImageDataUrl = '';

const fieldIds = [
  'brandName',
  'productName',
  'productCategory',
  'campaignSchedule',
  'rewardType',
  'rewardAmount',
  'productFeature',
  'proposalContent',
];

collabImageDrop.addEventListener('click', () => collabImageInput.click());

collabImageInput.addEventListener('change', () => {
  const file = collabImageInput.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    selectedImageDataUrl = String(reader.result || '');
    collabImagePreview.src = selectedImageDataUrl;
    collabImagePreview.classList.remove('hidden');
    collabImagePlus.classList.add('hidden');
  };
  reader.readAsDataURL(file);
});

campaignTypeGroup.addEventListener('click', (event) => {
  const btn = event.target.closest('.collab-chip');
  if (!btn) return;
  [...campaignTypeGroup.querySelectorAll('.collab-chip')].forEach((chip) => chip.classList.remove('is-active'));
  btn.classList.add('is-active');
  selectedCampaignType = btn.dataset.value || '';
});

function setStatus(message) {
  collabSubmitStatus.textContent = message;
  collabSubmitStatus.classList.remove('hidden');
}

function setSubmitting(isSubmitting) {
  collabSubmitBtn.disabled = isSubmitting;
  collabSubmitBtn.textContent = isSubmitting ? '전송 중...' : '제출하기';
}

function getValue(id) {
  return document.getElementById(id).value.trim();
}

collabSubmitBtn.addEventListener('click', async () => {
  const brandName = getValue('brandName');
  const productName = getValue('productName');

  if (!selectedCampaignType) {
    setStatus('캠페인 유형을 선택해주세요.');
    return;
  }
  if (!brandName || !productName) {
    setStatus('브랜드와 상품/서비스명을 입력해주세요.');
    return;
  }

  const payload = {
    campaignType: selectedCampaignType,
    brandName,
    productName,
    productCategory: getValue('productCategory'),
    campaignSchedule: getValue('campaignSchedule'),
    rewardType: getValue('rewardType'),
    rewardAmount: getValue('rewardAmount'),
    productFeature: getValue('productFeature'),
    proposalContent: getValue('proposalContent'),
    imageDataUrl: selectedImageDataUrl,
    source: 'collab.html',
    submittedAt: new Date().toISOString(),
  };

  try {
    setSubmitting(true);
    collabSubmitStatus.classList.add('hidden');

    const response = await fetch('/api/collab-submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result?.error || '제출에 실패했어요');
    }

    setStatus('접수됐어요. 시트에 저장됐고 확인 후 연락드릴게요.');
    fieldIds.forEach((id) => { document.getElementById(id).value = ''; });
    selectedCampaignType = '';
    [...campaignTypeGroup.querySelectorAll('.collab-chip')].forEach((chip) => chip.classList.remove('is-active'));
    selectedImageDataUrl = '';
    collabImagePreview.src = '';
    collabImagePreview.classList.add('hidden');
    collabImagePlus.classList.remove('hidden');
    collabImageInput.value = '';
  } catch (error) {
    setStatus(error?.message || '제출 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.');
  } finally {
    setSubmitting(false);
  }
});
