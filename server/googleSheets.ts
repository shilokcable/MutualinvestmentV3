import {
  db,
  computeAccounts,
  memberNetDeposit,
  dhakaTimestampStr,
  getSetting,
  setSetting,
  type MemberRow,
  type TxRow,
  type BankEntryRow,
  type NoticeRow,
} from './db.ts';

export function buildAllSheetsPayload() {
  const acc = computeAccounts();
  const members = db.prepare('SELECT * FROM members ORDER BY id ASC').all() as MemberRow[];
  const memberNameMap = new Map(members.map((m) => [m.id, m.name]));
  const transactions = db
    .prepare('SELECT * FROM transactions ORDER BY tx_date DESC, rowid DESC')
    .all() as TxRow[];
  const bankEntries = db
    .prepare('SELECT * FROM bank_entries ORDER BY entry_date DESC, rowid DESC')
    .all() as BankEntryRow[];
  const kycRows = db.prepare('SELECT * FROM kyc ORDER BY member_id ASC').all() as Array<
    Record<string, string>
  >;
  const kycMap = new Map(kycRows.map((k) => [k.member_id.toUpperCase(), k]));
  const kycRequests = db.prepare('SELECT * FROM kyc_requests ORDER BY rowid DESC').all() as Array<
    Record<string, string>
  >;
  const notices = db.prepare('SELECT * FROM notices ORDER BY rowid DESC').all() as NoticeRow[];
  const nowStr = dhakaTimestampStr();

  const sheets: Record<string, Array<Array<string | number>>> = {
    Summary: [
      ['Metric', 'Value'],
      ['App Name', 'MUTUAL INVESTMENT-2026'],
      ['Last Synced (Dhaka)', nowStr],
      ['Total Members', members.length],
      ['Opening Bank Balance (BDT)', acc.opening],
      ['Member Net Deposit (BDT)', acc.memberNet],
      ['Bank Net Adjustments (BDT)', acc.bankNet],
      ['Main Bank Balance (BDT)', acc.mainBank],
      ['Active FDR Balance (BDT)', acc.fdrBalance],
      ['Total Institutional Funds (BDT)', acc.totalInstitutional],
      ['Active FDR Count', acc.activeFdr],
      ['Maturity Pending FDR Count', acc.pendingFdr],
    ],
    Members: [
      ['Member ID', 'Name', 'Mobile', 'Status', 'Net Deposit (BDT)', 'KYC Status', 'Created At'],
      ...members.map((m) => [
        m.id,
        m.name,
        m.mobile || '',
        m.status,
        memberNetDeposit(m.id),
        kycMap.get(m.id.toUpperCase())?.status || 'Pending',
        m.created_at,
      ]),
    ],
    Transactions: [
      ['TX ID', 'Date', 'Member ID', 'Member Name', 'Type', 'Amount (BDT)', 'Note', 'Created At'],
      ...transactions.map((t) => [
        t.id,
        t.tx_date,
        t.member_id,
        memberNameMap.get(t.member_id) || '',
        t.type,
        Number(t.amount || 0),
        t.note || '',
        t.created_at,
      ]),
    ],
    FDR: [
      [
        'FDR ID',
        'Date',
        'Amount (BDT)',
        'Tenure (Months)',
        'Maturity Date',
        'Bank Name',
        'FDR No',
        'Status',
        'Return Date',
        'Returned Amount (BDT)',
        'Reference',
        'Note',
      ],
      ...acc.fdrList.map((f) => [
        f.id,
        f.date,
        f.amount,
        f.tenure,
        f.maturity,
        f.bank || '',
        f.no || '',
        f.status,
        f.returnDate || '',
        f.returned || 0,
        f.ref || '',
        f.note || '',
      ]),
    ],
    BankEntries: [
      ['Entry ID', 'Date', 'Type', 'Amount (BDT)', 'Reference', 'Note', 'Created At'],
      ...bankEntries.map((b) => [
        b.id,
        b.entry_date,
        b.type,
        Number(b.amount || 0),
        b.reference || '',
        b.note || '',
        b.created_at,
      ]),
    ],
    KYC: [
      [
        'Member ID',
        'Shareholder Name',
        'NID Number',
        'DOB',
        'Father Name',
        'Mother Name',
        'Spouse Name',
        'Marital Status',
        'Profession',
        'Email',
        'BD Phone',
        'WhatsApp',
        'Overseas Phone',
        'TIN Number',
        'Passport Number',
        'Permanent Address',
        'Present Address',
        'Nominee Name',
        'Nominee NID',
        'Nominee DOB',
        'Nominee Relation',
        'Nominee Phone',
        'Nominee Address',
        'Shareholder Photo',
        'Shareholder NID',
        'Nominee Photo',
        'Nominee NID',
        'Status',
        'Submitted At',
      ],
      ...kycRows.map((k) => [
        k.member_id || '',
        k.shareholder_name || '',
        k.nid_number || '',
        k.dob || '',
        k.father_name || '',
        k.mother_name || '',
        k.spouse_name || '',
        k.marital_status || '',
        k.profession || '',
        k.email || '',
        k.bd_phone || '',
        k.whatsapp || '',
        k.overseas_phone || '',
        k.tin_number || '',
        k.passport_number || '',
        k.permanent_address || '',
        k.present_address || '',
        k.nominee_name || '',
        k.nominee_nid || '',
        k.nominee_dob || '',
        k.nominee_relation || '',
        k.nominee_phone || '',
        k.nominee_address || '',
        k.member_photo ? 'Uploaded' : 'Missing',
        k.shareholder_nid_front && k.shareholder_nid_back ? 'Uploaded' : 'Missing',
        k.nominee_photo ? 'Uploaded' : 'Missing',
        k.nominee_nid_front && k.nominee_nid_back ? 'Uploaded' : 'Missing',
        k.status || 'Pending',
        k.submitted_at || '',
      ]),
    ],
    KYCRequests: [
      ['Request ID', 'Member ID', 'Name', 'Request', 'Request Date', 'Status', 'Reviewed Date', 'Admin Note'],
      ...kycRequests.map((r) => [
        r.id || '',
        r.member_id || '',
        r.member_name || '',
        r.request || '',
        r.request_date || '',
        r.status || 'Pending',
        r.approved_date || '',
        r.admin_note || '',
      ]),
    ],
    Notices: [
      ['Notice ID', 'Title', 'Body', 'Priority', 'Published', 'Created At'],
      ...notices.map((n) => [
        n.id,
        n.title,
        n.body,
        n.priority,
        n.published ? 'Yes' : 'No',
        n.created_at,
      ]),
    ],
  };

  const rowsSynced =
    members.length +
    transactions.length +
    acc.fdrList.length +
    bankEntries.length +
    kycRows.length +
    kycRequests.length +
    notices.length;

  return { nowStr, sheets, rowsSynced };
}

export async function pushAllDataToAppsScript(webhookUrlInput?: string) {
  const webhookUrl = String(webhookUrlInput || getSetting('apps_script_url')).trim();
  if (!webhookUrl) {
    throw new Error('Google Apps Script Web App URL সেট করা নেই।');
  }
  if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec/i.test(webhookUrl)) {
    throw new Error('সঠিক Google Apps Script Web App URL দিন (https://script.google.com/macros/s/.../exec)');
  }

  const { nowStr, sheets, rowsSynced } = buildAllSheetsPayload();

  const res = await fetch(webhookUrl, {
    method: 'POST',
    redirect: 'follow',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({
      app: 'MUTUAL INVESTMENT-2026',
      syncedAt: nowStr,
      sheets,
    }),
  });

  const rawText = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(rawText);
  } catch {
    throw new Error(
      `Apps Script থেকে সঠিক JSON পাওয়া যায়নি (Status ${res.status})। Deploy করার সময় "Who has access: Anyone" নির্বাচন করেছেন কিনা যাচাই করুন।`
    );
  }

  if (!res.ok || json.ok === false) {
    throw new Error(String(json.message || `Apps Script sync error (${res.status})`));
  }

  const spreadsheetUrl = String(json.spreadsheetUrl || getSetting('google_sheet_url', '') || '');
  const title = String(json.title || 'Google Spreadsheet');

  setSetting('apps_script_url', webhookUrl);
  if (spreadsheetUrl) setSetting('google_sheet_url', spreadsheetUrl);
  setSetting('google_sheet_last_sync', nowStr);

  return {
    webhookUrl,
    spreadsheetUrl,
    title,
    lastSync: nowStr,
    rowsSynced,
  };
}
