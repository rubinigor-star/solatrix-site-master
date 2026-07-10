const SHEET_NAME = 'Leads';
const HEADERS = [
  'Lead ID',
  'Lead Number',
  'Created At',
  'Duplicate',
  'Status',
  'Name',
  'Phone',
  'Email',
  'Address',
  'Property Type',
  'Monthly Bill',
  'Preferred Contact Time',
  'Message',
  'Source Type',
  'Source Page',
  'UTM Source',
  'UTM Medium',
  'UTM Campaign'
];

function doPost(event) {
  try {
    const body = JSON.parse(event.postData.contents || '{}');
    const properties = PropertiesService.getScriptProperties();
    const expectedSecret = properties.getProperty('WEBHOOK_SECRET');
    const spreadsheetId = properties.getProperty('SPREADSHEET_ID');

    if (!expectedSecret || body.secret !== expectedSecret) {
      return jsonResponse({ ok: false, error: 'unauthorized' }, 401);
    }
    if (!spreadsheetId) {
      return jsonResponse({ ok: false, error: 'missing_spreadsheet_id' }, 500);
    }

    const lead = body.lead || {};
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const sheet = getOrCreateSheet(spreadsheet);

    sheet.appendRow([
      lead.id || '',
      lead.lead_number || '',
      lead.created_at || new Date().toISOString(),
      body.duplicate ? 'Yes' : 'No',
      lead.status || '',
      lead.name || '',
      lead.phone || '',
      lead.email || '',
      lead.city_or_address || '',
      lead.property_type || '',
      lead.monthly_bill || '',
      lead.preferred_contact_time || '',
      lead.message || '',
      lead.source_type || '',
      lead.source_page || '',
      lead.utm_source || '',
      lead.utm_medium || '',
      lead.utm_campaign || ''
    ]);

    return jsonResponse({ ok: true });
  } catch (error) {
    console.error(error);
    return jsonResponse({ ok: false, error: String(error) }, 500);
  }
}

function getOrCreateSheet(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(SHEET_NAME);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
