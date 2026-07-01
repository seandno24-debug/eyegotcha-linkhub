const collabImageInput = document.getElementById('collabImageInput');
const collabImageDrop = document.getElementById('collabImageDrop');
const collabImagePreview = document.getElementById('collabImagePreview');
const collabImagePlus = document.getElementById('collabImagePlus');
const campaignTypeGroup = document.getElementById('campaignTypeGroup');
const collabSubmitBtn = document.getElementById('collabSubmitBtn');
const collabSubmitStatus = document.getElementById('collabSubmitStatus');

let selectedCampaignType = '';

collabImageDrop.addEventListener('click', () => collabImageInput.click());

collabImageInput.addEventListener('change', () => {
  const file = collabImageInput.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    collabImagePreview.src = String(reader.result || '');
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

collabSubmitBtn.addEventListener('click', () => {
  const brandName = document.getElementById('brandName').value.trim();
  const productName = document.getElementById('productName').value.trim();

  if (!selectedCampaignType) {
    setStatus('캠페인 유형을 선택해주세요.');
    return;
  }
  if (!brandName || !productName) {
    setStatus('브랜드와 상품/서비스명을 입력해주세요.');
    return;
  }

  // NOTE: 저장소(제안서 게시판) 연동은 아직 미확정 상태.
  // 사용자가 저장 방식(Google Sheets vs Vercel KV/Postgres)을 정하면
  // 이 부분에서 실제 제출 처리를 이어서 구현할 예정.
  setStatus('제안서 접수 준비 중이에요. 곧 정식으로 연결될 예정입니다. 급하면 이메일 버튼으로 연락해주세요!');
});
