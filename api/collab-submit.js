const SHEET_WEBHOOK_URL = process.env.COLLAB_SHEETS_WEBHOOK_URL || '';
const WEBHOOK_SECRET = process.env.ADMIN_PASSWORD || '';

function clean(value) {
  return String(value ?? '').trim();
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const campaignType = clean(body.campaignType);
    const brandName = clean(body.brandName);
    const productName = clean(body.productName);

    if (!campaignType || !brandName || !productName) {
      res.status(400).json({ error: '필수 항목이 부족합니다' });
      return;
    }

    const submittedAt = clean(body.submittedAt) || new Date().toISOString();

    const row = {
      submitted_at: submittedAt,
      campaign_type: campaignType,
      brand_name: brandName,
      product_name: productName,
      product_category: clean(body.productCategory),
      campaign_schedule: clean(body.campaignSchedule),
      reward_type: clean(body.rewardType),
      reward_amount: clean(body.rewardAmount),
      product_feature: clean(body.productFeature),
      proposal_content: clean(body.proposalContent),
      image_url: '',
      source: clean(body.source) || 'collab.html',
    };

    if (!SHEET_WEBHOOK_URL) {
      res.status(503).json({ error: 'COLLAB_SHEETS_WEBHOOK_URL가 설정되지 않았어요' });
      return;
    }

    const webhookResponse = await fetch(SHEET_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'appendCollabSubmission',
        secret: WEBHOOK_SECRET,
        row,
      }),
    });

    const webhookResult = await webhookResponse.json().catch(() => ({}));
    if (!webhookResponse.ok) {
      throw new Error(webhookResult?.error || '시트 저장에 실패했어요');
    }

    res.status(200).json({ ok: true, sheetStored: true });
  } catch (error) {
    res.status(500).json({ error: error?.message || 'Server error' });
  }
}
