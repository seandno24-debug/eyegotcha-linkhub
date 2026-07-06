const SHEET_NAME = '협업제안목록';
const SPREADSHEET_ID = '1r7hjZhKBTXWQh0GYNZyYJven8VoaNaDYEc98xw1LBGI';
const WEBHOOK_SECRET = '1q2w3E4R!@';

function doGet() {
  return json_({ ok: true, message: 'collab webhook ready' });
}

function doPost(e) {
  try {
    const payload = parsePayload_(e);
    if (!payload || payload.action !== 'appendCollabSubmission') {
      return json_({ ok: false, error: 'Invalid action' }, 400);
    }

    if (!payload.secret || payload.secret !== WEBHOOK_SECRET) {
      return json_({ ok: false, error: 'Unauthorized' }, 403);
    }

    const row = payload.row || {};
    const spreadsheet = getSpreadsheet_();
    const sheet = spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.insertSheet(SHEET_NAME);
    ensureHeader_(sheet);

    sheet.appendRow([
      row.submitted_at || '',
      row.campaign_type || '',
      row.brand_name || '',
      row.product_name || '',
      row.product_category || '',
      row.campaign_schedule || '',
      row.reward_type || '',
      row.reward_amount || '',
      row.product_feature || '',
      row.proposal_content || '',
      row.image_url || '',
      row.source || '',
    ]);

    return json_({ ok: true });
  } catch (error) {
    return json_({ ok: false, error: error.message || String(error) }, 500);
  }
}

function parsePayload_(e) {
  if (!e || !e.postData || !e.postData.contents) return null;
  return JSON.parse(e.postData.contents);
}

function ensureHeader_(sheet) {
  if (sheet.getLastRow() > 0) return;
  sheet.appendRow([
    'submitted_at',
    'campaign_type',
    'brand_name',
    'product_name',
    'product_category',
    'campaign_schedule',
    'reward_type',
    'reward_amount',
    'product_feature',
    'proposal_content',
    'image_url',
    'source',
  ]);
}

function getSpreadsheet_() {
  if (SPREADSHEET_ID && SPREADSHEET_ID !== 'PUT_SPREADSHEET_ID_HERE') {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) {
    throw new Error('SPREADSHEET_ID를 설정하세요');
  }
  return active;
}

function json_(obj, statusCode) {
  const output = ContentService.createTextOutput(JSON.stringify(obj));
  output.setMimeType(ContentService.MimeType.JSON);
  if (statusCode) {
    output.setHeader('X-Status-Code', String(statusCode));
  }
  return output;
}
