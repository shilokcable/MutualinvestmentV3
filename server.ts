import express from 'express';
import path from 'path';
import fs from 'fs';
import {
  db,
  initSchema,
  createSession,
  getSession,
  deleteSession,
  computeAccounts,
  memberNetDeposit,
  addMonthsToDateStr,
  dhakaTodayStr,
  dhakaTimestampStr,
  getSetting,
  setSetting,
  CFG,
  type MemberRow,
  type TxRow,
  type BankEntryRow,
  type NoticeRow,
} from './server/db.ts';
import { pushAllDataToAppsScript } from './server/googleSheets.ts';

initSchema();

const app = express();
app.use(express.json({ limit: '30mb' }));

// Helper to get bearer or header token
function extractToken(req: express.Request): string {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  const hdr = req.headers['x-session-token'];
  if (typeof hdr === 'string') return hdr.trim();
  return '';
}

async function maybeSyncSheets(_req?: express.Request): Promise<{ sheetSynced: boolean; sheetError?: string }> {
  const webhookUrl = getSetting('apps_script_url');
  if (!webhookUrl) {
    return { sheetSynced: false };
  }
  try {
    await pushAllDataToAppsScript(webhookUrl);
    return { sheetSynced: true };
  } catch (err) {
    return {
      sheetSynced: false,
      sheetError: err instanceof Error ? err.message : 'Google Sheets sync failed',
    };
  }
}

function getPublishedNotices() {
  const rows = db
    .prepare('SELECT * FROM notices WHERE published = 1 ORDER BY rowid DESC')
    .all() as NoticeRow[];
  return rows.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    priority: n.priority || 'Normal',
    createdAt: n.created_at,
  }));
}

function getKycForMember(memberId: string, includeMedia: boolean) {
  const member = db
    .prepare('SELECT id, name, mobile, status FROM members WHERE UPPER(id) = UPPER(?)')
    .get(memberId) as { id: string; name: string; mobile: string; status: string } | undefined;

  const row = db
    .prepare('SELECT * FROM kyc WHERE UPPER(member_id) = UPPER(?)')
    .get(memberId) as Record<string, string> | undefined;

  const latestReq = db
    .prepare(
      'SELECT * FROM kyc_requests WHERE UPPER(member_id) = UPPER(?) ORDER BY rowid DESC LIMIT 1'
    )
    .get(memberId) as
    | {
        id: string;
        request: string;
        request_date: string;
        status: string;
        approved_date: string;
        admin_note: string;
      }
    | undefined;

  const completed = row ? row.status === 'Completed' : false;
  const updatePermission = row ? row.update_permission === 'Approved' : false;

  const kycObj: Record<string, unknown> = {
    memberId: member?.id || memberId,
    name: (row && row.shareholder_name) || member?.name || '',
    nidNumber: row?.nid_number || '',
    dob: row?.dob || '',
    fatherName: row?.father_name || '',
    motherName: row?.mother_name || '',
    spouseName: row?.spouse_name || '',
    maritalStatus: row?.marital_status || '',
    profession: row?.profession || '',
    email: row?.email || '',
    bdPhone: row?.bd_phone || '',
    whatsapp: row?.whatsapp || '',
    overseasPhone: row?.overseas_phone || '',
    tinNumber: row?.tin_number || '',
    passportNumber: row?.passport_number || '',
    permanentAddress: row?.permanent_address || '',
    presentAddress: row?.present_address || '',
    nomineeName: row?.nominee_name || '',
    nomineeNid: row?.nominee_nid || '',
    nomineeDob: row?.nominee_dob || '',
    nomineeRelation: row?.nominee_relation || '',
    nomineePhone: row?.nominee_phone || '',
    nomineeAddress: row?.nominee_address || '',
    notes: row?.notes || '',
    updated: row?.submitted_at || '',
    completed,
    updatePermission,
    status: row?.status || 'Pending',
    photoData: row?.member_photo || '',
    requestStatus: latestReq?.status || '',
    requestNote: latestReq?.admin_note || '',
    requestText: latestReq?.request || '',
    requestDate: latestReq?.request_date || '',
  };

  if (includeMedia && row) {
    kycObj.shareholderNidFront = row.shareholder_nid_front || '';
    kycObj.shareholderNidBack = row.shareholder_nid_back || '';
    kycObj.memberPhoto = row.member_photo || '';
    kycObj.tinCertificate = row.tin_certificate || '';
    kycObj.passportCopy = row.passport_copy || '';
    kycObj.nomineeNidFront = row.nominee_nid_front || '';
    kycObj.nomineeNidBack = row.nominee_nid_back || '';
    kycObj.nomineePhoto = row.nominee_photo || '';
  }

  return kycObj;
}

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, app: CFG.APP_NAME });
});

// Public Notices (Main page & dashboards)
app.get('/api/notices', (_req, res) => {
  res.json({ ok: true, notices: getPublishedNotices() });
});

// Member Login
app.post('/api/auth/member-login', (req, res) => {
  const memberId = String(req.body?.memberId || '').trim().toUpperCase();
  const password = String(req.body?.password || '').trim();

  if (!memberId || !password) {
    res.json({ ok: false, message: 'Member ID এবং Password দিন।' });
    return;
  }

  const member = db
    .prepare('SELECT * FROM members WHERE UPPER(id) = UPPER(?)')
    .get(memberId) as MemberRow | undefined;

  if (!member) {
    res.json({ ok: false, message: 'Member ID পাওয়া যায়নি।' });
    return;
  }
  if (member.status.toLowerCase() === 'inactive') {
    res.json({ ok: false, message: 'আপনার account inactive আছে। Admin-এর সাথে যোগাযোগ করুন।' });
    return;
  }
  if (String(member.password).trim() !== password) {
    res.json({ ok: false, message: 'ভুল Password।' });
    return;
  }

  const token = createSession('member', member.id);
  res.json({ ok: true, token, role: 'member', memberId: member.id });
});

// Admin Login
app.post('/api/auth/admin-login', (req, res) => {
  const pin = String(req.body?.pin || '').trim();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('admin_pin') as
    | { value: string }
    | undefined;
  const savedPin = String(row?.value || '2026').trim();

  if (!pin || pin !== savedPin) {
    res.json({ ok: false, message: 'ভুল Admin PIN।' });
    return;
  }

  const token = createSession('admin', 'ADMIN');
  res.json({ ok: true, token, role: 'admin' });
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  const token = extractToken(req);
  deleteSession(token);
  res.json({ ok: true });
});

// Dashboard
app.get('/api/dashboard', (req, res) => {
  const token = extractToken(req);
  const ses = getSession(token);
  if (!ses) {
    res.status(401).json({ ok: false, message: 'Session expired. আবার login করুন।' });
    return;
  }

  const acc = computeAccounts();

  if (ses.role === 'member') {
    const member = db
      .prepare('SELECT * FROM members WHERE UPPER(id) = UPPER(?)')
      .get(ses.memberId) as MemberRow | undefined;
    if (!member) {
      res.status(404).json({ ok: false, message: 'Member পাওয়া যায়নি।' });
      return;
    }

    const txRows = db
      .prepare('SELECT * FROM transactions WHERE UPPER(member_id) = UPPER(?) ORDER BY tx_date DESC, rowid DESC')
      .all(ses.memberId) as TxRow[];

    const transactions = txRows.map((x) => ({
      id: x.id,
      date: x.tx_date,
      type: x.type,
      amount: Number(x.amount || 0),
      note: x.note || '',
    }));

    const total = transactions.reduce(
      (s, x) => s + (x.type === 'Withdrawal' ? -x.amount : x.amount),
      0
    );

    const kyc = getKycForMember(ses.memberId, true);

    res.json({
      ok: true,
      role: 'member',
      memberId: member.id,
      name: member.name,
      mobile: member.mobile,
      accountStatus: member.status,
      total,
      transactions,
      mainBank: acc.mainBank,
      fdrBalance: acc.fdrBalance,
      totalInstitutional: acc.totalInstitutional,
      activeFdr: acc.activeFdr,
      pendingFdr: acc.pendingFdr,
      kyc,
      notices: getPublishedNotices(),
    });
    return;
  }

  // Admin dashboard
  const membersRaw = db.prepare('SELECT * FROM members ORDER BY id ASC').all() as MemberRow[];
  const allTx = db.prepare('SELECT * FROM transactions ORDER BY tx_date DESC, rowid DESC').all() as TxRow[];

  const mapById: Record<string, { id: string; name: string; mobile: string; status: string; total: number }> = {};
  for (const m of membersRaw) {
    mapById[m.id] = {
      id: m.id,
      name: m.name,
      mobile: m.mobile,
      status: m.status,
      total: 0,
    };
  }

  const curMonth = dhakaTodayStr().slice(0, 7); // YYYY-MM
  let totalDeposit = 0;
  let thisMonth = 0;

  for (const x of allTx) {
    const amt = Number(x.amount || 0);
    const val = x.type === 'Withdrawal' ? -amt : amt;
    totalDeposit += val;
    if (mapById[x.member_id]) {
      mapById[x.member_id].total += val;
    }
    if ((x.tx_date || '').startsWith(curMonth)) {
      thisMonth += val;
    }
  }

  const membersList = Object.values(mapById).map((m) => {
    const kycRow = db
      .prepare('SELECT status, member_photo FROM kyc WHERE UPPER(member_id) = UPPER(?)')
      .get(m.id) as { status: string; member_photo: string } | undefined;
    return {
      ...m,
      kycStatus: kycRow?.status || 'Pending',
      photoData: kycRow?.member_photo || '',
    };
  });

  const recent = allTx.slice(0, 50).map((x) => ({
    id: x.id,
    date: x.tx_date,
    memberId: x.member_id,
    name: mapById[x.member_id]?.name || '',
    type: x.type,
    amount: Number(x.amount || 0),
    note: x.note || '',
  }));

  const bankEntries = db
    .prepare('SELECT * FROM bank_entries ORDER BY entry_date DESC, rowid DESC LIMIT 50')
    .all() as BankEntryRow[];

  const kycRequests = db
    .prepare('SELECT * FROM kyc_requests ORDER BY rowid DESC')
    .all() as Array<{
    id: string;
    member_id: string;
    member_name: string;
    request: string;
    request_date: string;
    status: string;
    approved_date: string;
    admin_note: string;
  }>;

  const openingRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('opening_balance') as
    | { value: string }
    | undefined;

  res.json({
    ok: true,
    role: 'admin',
    memberCount: membersRaw.length,
    maxMembers: CFG.MAX_MEMBERS,
    totalDeposit,
    thisMonth,
    mainBank: acc.mainBank,
    fdrBalance: acc.fdrBalance,
    totalInstitutional: acc.totalInstitutional,
    activeFdr: acc.activeFdr,
    pendingFdr: acc.pendingFdr,
    openingBalance: Number(openingRow?.value || 0),
    members: membersList,
    recent,
    fdrList: acc.fdrList,
    bankEntries: bankEntries.map((b) => ({
      id: b.id,
      date: b.entry_date,
      type: b.type,
      amount: Number(b.amount || 0),
      reference: b.reference || '',
      note: b.note || '',
    })),
    kycRequests: kycRequests.map((r) => ({
      id: r.id,
      memberId: r.member_id,
      name: r.member_name,
      request: r.request,
      requestDate: r.request_date,
      status: r.status,
      approvedDate: r.approved_date,
      adminNote: r.admin_note,
    })),
    notices: getPublishedNotices(),
    sheetConfig: {
      webhookUrl: getSetting('apps_script_url', ''),
      sheetUrl: getSetting('google_sheet_url', ''),
      lastSync: getSetting('google_sheet_last_sync', ''),
    },
  });
});

// Save Transaction (Admin only)
app.post('/api/transactions', async (req, res) => {
  const ses = getSession(extractToken(req));
  if (!ses || ses.role !== 'admin') {
    res.status(403).json({ ok: false, message: 'Admin permission required.' });
    return;
  }

  const memberId = String(req.body?.memberId || '').trim().toUpperCase();
  const amount = Number(req.body?.amount);
  const type = String(req.body?.type || 'Monthly Deposit').trim();
  const txDate = String(req.body?.date || dhakaTodayStr()).trim();
  const note = String(req.body?.note || '').trim();

  if (!memberId) {
    res.status(400).json({ ok: false, message: 'Member নির্বাচন করুন।' });
    return;
  }
  if (!amount || amount <= 0) {
    res.status(400).json({ ok: false, message: 'সঠিক টাকার পরিমাণ দিন।' });
    return;
  }

  const member = db
    .prepare('SELECT * FROM members WHERE UPPER(id) = UPPER(?)')
    .get(memberId) as MemberRow | undefined;
  if (!member) {
    res.status(404).json({ ok: false, message: 'সদস্য পাওয়া যায়নি।' });
    return;
  }
  if (member.status.toLowerCase() === 'inactive') {
    res.status(400).json({ ok: false, message: 'Inactive সদস্যের জন্য লেনদেন করা যাবে না।' });
    return;
  }

  if (type === 'Withdrawal') {
    const net = memberNetDeposit(member.id);
    if (amount > net) {
      res.status(400).json({ ok: false, message: `Withdrawal member-এর জমার (${net}) বেশি হতে পারবে না।` });
      return;
    }
  }

  const id = `TX-${Date.now()}`;
  db.prepare(
    'INSERT INTO transactions (id, tx_date, member_id, amount, type, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, txDate, member.id, amount, type, note, dhakaTimestampStr());

  const sync = await maybeSyncSheets(req);
  res.json({ ok: true, id, ...sync });
});

// Save FDR (Admin only)
app.post('/api/fdr', async (req, res) => {
  const ses = getSession(extractToken(req));
  if (!ses || ses.role !== 'admin') {
    res.status(403).json({ ok: false, message: 'Admin permission required.' });
    return;
  }

  const amount = Number(req.body?.amount);
  const fdrDate = String(req.body?.date || '').trim();
  const tenure = Number(req.body?.tenure || 0);
  const bankName = String(req.body?.bank || '').trim();
  const fdrNo = String(req.body?.fdrNo || '').trim();
  const ref = String(req.body?.ref || '').trim();
  const note = String(req.body?.note || '').trim();

  if (!amount || amount <= 0) {
    res.status(400).json({ ok: false, message: 'সঠিক FDR পরিমাণ দিন।' });
    return;
  }
  if (!fdrDate) {
    res.status(400).json({ ok: false, message: 'FDR Date দিন।' });
    return;
  }
  if (!tenure || tenure <= 0) {
    res.status(400).json({ ok: false, message: 'Tenure (months) দিন।' });
    return;
  }

  const acc = computeAccounts();
  if (amount > acc.mainBank) {
    res.status(400).json({ ok: false, message: `Main Bank Balance-এর (${acc.mainBank}) বেশি FDR করা যাবে না।` });
    return;
  }

  const maturityDate = addMonthsToDateStr(fdrDate, tenure);
  const countRow = db.prepare('SELECT COUNT(*) as cnt FROM fdr').get() as { cnt: number };
  const id = `FDR-${String(countRow.cnt + 1).padStart(3, '0')}`;

  db.prepare(
    'INSERT INTO fdr (id, amount, fdr_date, tenure, maturity_date, bank_name, fdr_no, return_date, returned_amount, ref, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, amount, fdrDate, tenure, maturityDate, bankName, fdrNo, '', 0, ref, note);

  const sync = await maybeSyncSheets(req);
  res.json({ ok: true, id, ...sync });
});

// Return FDR (Admin only)
app.post('/api/fdr/return', async (req, res) => {
  const ses = getSession(extractToken(req));
  if (!ses || ses.role !== 'admin') {
    res.status(403).json({ ok: false, message: 'Admin permission required.' });
    return;
  }

  const fdrId = String(req.body?.fdrId || '').trim();
  const returnDate = String(req.body?.returnDate || dhakaTodayStr()).trim();
  const returnedAmount = Number(req.body?.returnedAmount);
  const ref = String(req.body?.ref || '').trim();
  const note = String(req.body?.note || '').trim();

  if (!fdrId) {
    res.status(400).json({ ok: false, message: 'FDR নির্বাচন করুন।' });
    return;
  }
  if (!returnedAmount || returnedAmount <= 0) {
    res.status(400).json({ ok: false, message: 'Returned amount দিন।' });
    return;
  }

  const row = db.prepare('SELECT * FROM fdr WHERE id = ?').get(fdrId) as { return_date: string } | undefined;
  if (!row) {
    res.status(404).json({ ok: false, message: 'FDR পাওয়া যায়নি।' });
    return;
  }
  if (row.return_date) {
    res.status(400).json({ ok: false, message: 'এই FDR আগেই return করা হয়েছে।' });
    return;
  }

  db.prepare(
    'UPDATE fdr SET return_date = ?, returned_amount = ?, ref = COALESCE(NULLIF(?, \'\'), ref), note = COALESCE(NULLIF(?, \'\'), note) WHERE id = ?'
  ).run(returnDate, returnedAmount, ref, note, fdrId);

  const sync = await maybeSyncSheets(req);
  res.json({ ok: true, ...sync });
});

// Save Bank Entry (Admin only)
app.post('/api/bank', async (req, res) => {
  const ses = getSession(extractToken(req));
  if (!ses || ses.role !== 'admin') {
    res.status(403).json({ ok: false, message: 'Admin permission required.' });
    return;
  }

  const entryDate = String(req.body?.date || dhakaTodayStr()).trim();
  const type = String(req.body?.type || 'Bank Credit').trim();
  const amount = Number(req.body?.amount);
  const reference = String(req.body?.ref || '').trim();
  const note = String(req.body?.note || '').trim();

  if (!amount || amount <= 0) {
    res.status(400).json({ ok: false, message: 'সঠিক amount দিন।' });
    return;
  }

  const id = `BNK-${Date.now()}`;
  db.prepare(
    'INSERT INTO bank_entries (id, entry_date, type, amount, reference, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, entryDate, type, amount, reference, note, dhakaTimestampStr());

  const sync = await maybeSyncSheets(req);
  res.json({ ok: true, id, ...sync });
});

// Add Member (Admin only)
app.post('/api/members', async (req, res) => {
  const ses = getSession(extractToken(req));
  if (!ses || ses.role !== 'admin') {
    res.status(403).json({ ok: false, message: 'Admin permission required.' });
    return;
  }

  const countRow = db.prepare('SELECT COUNT(*) as cnt FROM members').get() as { cnt: number };
  if (countRow.cnt >= CFG.MAX_MEMBERS) {
    res.status(400).json({ ok: false, message: `সর্বোচ্চ ${CFG.MAX_MEMBERS} জন সদস্য যোগ করা যাবে।` });
    return;
  }

  const id = String(req.body?.memberId || '').trim().toUpperCase();
  const name = String(req.body?.name || '').trim();
  const mobile = String(req.body?.mobile || '').trim();
  const status = String(req.body?.status || 'Active').trim();
  const password = String(req.body?.password || '1234').trim() || '1234';

  if (!id || !name) {
    res.status(400).json({ ok: false, message: 'Member ID এবং Name প্রয়োজন।' });
    return;
  }

  const existing = db.prepare('SELECT id FROM members WHERE UPPER(id) = UPPER(?)').get(id);
  if (existing) {
    res.status(400).json({ ok: false, message: 'এই Member ID আগেই রয়েছে।' });
    return;
  }

  db.prepare(
    'INSERT INTO members (id, name, mobile, status, password, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, name, mobile, status, password, dhakaTodayStr());

  const sync = await maybeSyncSheets(req);
  res.json({ ok: true, id, ...sync });
});

// Update Member (Admin only)
app.put('/api/members/:id', async (req, res) => {
  const ses = getSession(extractToken(req));
  if (!ses || ses.role !== 'admin') {
    res.status(403).json({ ok: false, message: 'Admin permission required.' });
    return;
  }

  const memberId = String(req.params.id || '').trim().toUpperCase();
  const existing = db
    .prepare('SELECT * FROM members WHERE UPPER(id) = UPPER(?)')
    .get(memberId) as MemberRow | undefined;
  if (!existing) {
    res.status(404).json({ ok: false, message: 'Member পাওয়া যায়নি।' });
    return;
  }

  const name = String(req.body?.name ?? existing.name).trim() || existing.name;
  const mobile = String(req.body?.mobile ?? existing.mobile).trim();
  const status = String(req.body?.status ?? existing.status).trim() || 'Active';
  const newPass = String(req.body?.password || '').trim();

  db.prepare(
    'UPDATE members SET name = ?, mobile = ?, status = ?, password = ? WHERE UPPER(id) = UPPER(?)'
  ).run(name, mobile, status, newPass || existing.password, memberId);

  const sync = await maybeSyncSheets(req);
  res.json({ ok: true, ...sync });
});

// Update Settings (Admin only)
app.put('/api/settings', async (req, res) => {
  const ses = getSession(extractToken(req));
  if (!ses || ses.role !== 'admin') {
    res.status(403).json({ ok: false, message: 'Admin permission required.' });
    return;
  }

  if (req.body?.openingBalance !== undefined) {
    const val = Number(req.body.openingBalance);
    if (isNaN(val)) {
      res.status(400).json({ ok: false, message: 'সঠিক Opening Balance দিন।' });
      return;
    }
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('opening_balance', String(val));
  }

  if (req.body?.newPin) {
    const pin = String(req.body.newPin).trim();
    if (pin.length < 4) {
      res.status(400).json({ ok: false, message: 'Admin PIN কমপক্ষে ৪ অক্ষরের হতে হবে।' });
      return;
    }
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('admin_pin', pin);
  }

  const sync = await maybeSyncSheets(req);
  res.json({ ok: true, ...sync });
});

// Get KYC (Member gets own; Admin can pass ?memberId=MI-01)
app.get('/api/kyc', (req, res) => {
  const ses = getSession(extractToken(req));
  if (!ses) {
    res.status(401).json({ ok: false, message: 'Session expired.' });
    return;
  }

  const targetId =
    ses.role === 'admin' && req.query.memberId
      ? String(req.query.memberId).trim().toUpperCase()
      : ses.memberId;

  if (!targetId) {
    res.status(400).json({ ok: false, message: 'Member ID প্রয়োজন।' });
    return;
  }

  const includeMedia = req.query.includeMedia !== 'false';
  res.json({ ok: true, kyc: getKycForMember(targetId, includeMedia) });
});

// Save / Submit KYC (Member)
app.post('/api/kyc', async (req, res) => {
  const ses = getSession(extractToken(req));
  if (!ses || ses.role !== 'member') {
    res.status(403).json({ ok: false, message: 'Member login required.' });
    return;
  }

  const payload = req.body || {};
  const required = [
    ['shareholderName', 'Shareholder Name'],
    ['nidNumber', 'Shareholder NID Number'],
    ['dob', 'Date of Birth'],
    ['permanentAddress', 'Permanent Address'],
    ['presentAddress', 'Present Address'],
    ['bdPhone', 'Bangladesh Phone'],
    ['profession', 'Profession'],
    ['fatherName', 'Father Name'],
    ['motherName', 'Mother Name'],
    ['nomineeName', 'Nominee Name'],
    ['nomineeNid', 'Nominee NID'],
    ['nomineeRelation', 'Nominee Relation'],
    ['nomineeDob', 'Nominee Date of Birth'],
  ] as const;

  for (const [k, label] of required) {
    if (!String(payload[k] || '').trim()) {
      res.status(400).json({ ok: false, message: `দয়া করে ${label} পূরণ করুন।` });
      return;
    }
  }

  const existing = db
    .prepare('SELECT * FROM kyc WHERE UPPER(member_id) = UPPER(?)')
    .get(ses.memberId) as Record<string, string> | undefined;

  if (existing && existing.status === 'Completed' && existing.update_permission !== 'Approved') {
    res.status(400).json({
      ok: false,
      message: 'KYC already submitted and locked. পরিবর্তনের জন্য Profile থেকে Request Update পাঠান।',
    });
    return;
  }

  const shareholderNidFront = String(payload.shareholderNidFront || existing?.shareholder_nid_front || '');
  const shareholderNidBack = String(payload.shareholderNidBack || existing?.shareholder_nid_back || '');
  const memberPhoto = String(payload.memberPhoto || existing?.member_photo || '');
  const tinCertificate = String(payload.tinCertificate || existing?.tin_certificate || '');
  const passportCopy = String(payload.passportCopy || existing?.passport_copy || '');
  const nomineeNidFront = String(payload.nomineeNidFront || existing?.nominee_nid_front || '');
  const nomineeNidBack = String(payload.nomineeNidBack || existing?.nominee_nid_back || '');
  const nomineePhoto = String(payload.nomineePhoto || existing?.nominee_photo || '');

  const reqImages = [
    [shareholderNidFront, 'Shareholder NID Front'],
    [shareholderNidBack, 'Shareholder NID Back'],
    [memberPhoto, 'Shareholder Photo'],
    [nomineeNidFront, 'Nominee NID Front'],
    [nomineeNidBack, 'Nominee NID Back'],
    [nomineePhoto, 'Nominee Photo'],
  ] as const;

  for (const [img, label] of reqImages) {
    if (!img) {
      res.status(400).json({ ok: false, message: `দয়া করে ${label} upload করুন।` });
      return;
    }
  }

  const submittedAt = dhakaTimestampStr();
  db.prepare(`
    INSERT OR REPLACE INTO kyc (
      member_id, shareholder_name, nid_number, dob, father_name, mother_name,
      spouse_name, marital_status, profession, email, bd_phone, whatsapp, overseas_phone,
      tin_number, passport_number, permanent_address, present_address,
      nominee_name, nominee_nid, nominee_dob, nominee_relation, nominee_phone, nominee_address,
      shareholder_nid_front, shareholder_nid_back, member_photo, tin_certificate, passport_copy,
      nominee_nid_front, nominee_nid_back, nominee_photo, notes, submitted_at, status, update_permission
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    ses.memberId,
    String(payload.shareholderName || '').trim(),
    String(payload.nidNumber || '').trim(),
    String(payload.dob || '').trim(),
    String(payload.fatherName || '').trim(),
    String(payload.motherName || '').trim(),
    String(payload.spouseName || '').trim(),
    String(payload.maritalStatus || '').trim(),
    String(payload.profession || '').trim(),
    String(payload.email || '').trim(),
    String(payload.bdPhone || '').trim(),
    String(payload.whatsapp || '').trim(),
    String(payload.overseasPhone || '').trim(),
    String(payload.tinNumber || '').trim(),
    String(payload.passportNumber || '').trim(),
    String(payload.permanentAddress || '').trim(),
    String(payload.presentAddress || '').trim(),
    String(payload.nomineeName || '').trim(),
    String(payload.nomineeNid || '').trim(),
    String(payload.nomineeDob || '').trim(),
    String(payload.nomineeRelation || '').trim(),
    String(payload.nomineePhone || '').trim(),
    String(payload.nomineeAddress || '').trim(),
    shareholderNidFront,
    shareholderNidBack,
    memberPhoto,
    tinCertificate,
    passportCopy,
    nomineeNidFront,
    nomineeNidBack,
    nomineePhoto,
    String(payload.notes || '').trim(),
    submittedAt,
    'Completed',
    ''
  );

  // Sync member name in members table
  db.prepare('UPDATE members SET name = ? WHERE UPPER(id) = UPPER(?)').run(
    String(payload.shareholderName || '').trim(),
    ses.memberId
  );

  const sync = await maybeSyncSheets(req);
  res.json({ ok: true, kyc: getKycForMember(ses.memberId, true), ...sync });
});

// Change Profile Photo only
app.post('/api/kyc/photo', (req, res) => {
  const ses = getSession(extractToken(req));
  if (!ses || ses.role !== 'member') {
    res.status(403).json({ ok: false, message: 'Member login required.' });
    return;
  }

  const photoData = String(req.body?.photoData || '');
  if (!photoData) {
    res.status(400).json({ ok: false, message: 'নতুন ছবি নির্বাচন করুন।' });
    return;
  }

  const existing = db.prepare('SELECT member_id FROM kyc WHERE UPPER(member_id) = UPPER(?)').get(ses.memberId);
  if (!existing) {
    res.status(400).json({ ok: false, message: 'আগে KYC জমা দিন।' });
    return;
  }

  db.prepare('UPDATE kyc SET member_photo = ?, submitted_at = ? WHERE UPPER(member_id) = UPPER(?)').run(
    photoData,
    dhakaTimestampStr(),
    ses.memberId
  );

  res.json({ ok: true, photoData });
});

// Submit KYC Update Request (Member)
app.post('/api/kyc/request', async (req, res) => {
  const ses = getSession(extractToken(req));
  if (!ses || ses.role !== 'member') {
    res.status(403).json({ ok: false, message: 'Member login required.' });
    return;
  }

  const requestText = String(req.body?.requestText || '').trim();
  if (!requestText) {
    res.status(400).json({ ok: false, message: 'কোন তথ্য পরিবর্তন করতে চান তা লিখুন।' });
    return;
  }

  const member = db
    .prepare('SELECT name FROM members WHERE UPPER(id) = UPPER(?)')
    .get(ses.memberId) as { name: string } | undefined;

  const id = `REQ-${Date.now()}`;
  db.prepare(
    'INSERT INTO kyc_requests (id, member_id, member_name, request, request_date, status, approved_date, admin_note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, ses.memberId, member?.name || ses.memberId, requestText, dhakaTimestampStr(), 'Pending', '', '');

  const sync = await maybeSyncSheets(req);
  res.json({ ok: true, id, ...sync });
});

// Review KYC Update Request (Admin)
app.post('/api/kyc/requests/:id/review', async (req, res) => {
  const ses = getSession(extractToken(req));
  if (!ses || ses.role !== 'admin') {
    res.status(403).json({ ok: false, message: 'Admin permission required.' });
    return;
  }

  const reqId = String(req.params.id || '').trim();
  const status = String(req.body?.status || '').trim();
  const adminNote = String(req.body?.adminNote || '').trim();

  if (status !== 'Approved' && status !== 'Rejected') {
    res.status(400).json({ ok: false, message: 'Invalid status.' });
    return;
  }

  const row = db
    .prepare('SELECT * FROM kyc_requests WHERE id = ?')
    .get(reqId) as { id: string; member_id: string } | undefined;
  if (!row) {
    res.status(404).json({ ok: false, message: 'Request পাওয়া যায়নি।' });
    return;
  }

  const nowStr = dhakaTimestampStr();
  db.prepare(
    'UPDATE kyc_requests SET status = ?, approved_date = ?, admin_note = ? WHERE id = ?'
  ).run(status, nowStr, adminNote, reqId);

  if (status === 'Approved') {
    db.prepare('UPDATE kyc SET update_permission = ? WHERE UPPER(member_id) = UPPER(?)').run(
      'Approved',
      row.member_id
    );
  }

  const sync = await maybeSyncSheets(req);
  res.json({ ok: true, ...sync });
});

// Statement (Member or Admin with ?memberId=)
app.get('/api/statement', (req, res) => {
  const ses = getSession(extractToken(req));
  if (!ses) {
    res.status(401).json({ ok: false, message: 'Session expired.' });
    return;
  }

  const targetId =
    ses.role === 'admin' && req.query.memberId
      ? String(req.query.memberId).trim().toUpperCase()
      : ses.memberId;

  const member = db
    .prepare('SELECT * FROM members WHERE UPPER(id) = UPPER(?)')
    .get(targetId) as MemberRow | undefined;
  if (!member) {
    res.status(404).json({ ok: false, message: 'Member পাওয়া যায়নি।' });
    return;
  }

  const txRows = db
    .prepare('SELECT * FROM transactions WHERE UPPER(member_id) = UPPER(?) ORDER BY tx_date DESC, rowid DESC')
    .all(targetId) as TxRow[];
  const transactions = txRows.map((x) => ({
    id: x.id,
    date: x.tx_date,
    type: x.type,
    amount: Number(x.amount || 0),
    note: x.note || '',
  }));

  const total = transactions.reduce((s, x) => s + (x.type === 'Withdrawal' ? -x.amount : x.amount), 0);
  const acc = computeAccounts();

  res.json({
    ok: true,
    memberId: member.id,
    name: member.name,
    mobile: member.mobile,
    accountStatus: member.status,
    total,
    transactions,
    mainBank: acc.mainBank,
    fdrBalance: acc.fdrBalance,
    totalInstitutional: acc.totalInstitutional,
  });
});

// Notices (Admin Create & Delete)
app.post('/api/notices', async (req, res) => {
  const ses = getSession(extractToken(req));
  if (!ses || ses.role !== 'admin') {
    res.status(403).json({ ok: false, message: 'Admin permission required.' });
    return;
  }

  const title = String(req.body?.title || '').trim();
  const body = String(req.body?.body || '').trim();
  const priority = String(req.body?.priority || 'Normal').trim() || 'Normal';
  if (!title || !body) {
    res.status(400).json({ ok: false, message: 'Notice Title এবং বিবরণ দিন।' });
    return;
  }

  const id = `NTC-${Date.now()}`;
  db.prepare(
    'INSERT INTO notices (id, title, body, priority, published, created_at) VALUES (?, ?, ?, ?, 1, ?)'
  ).run(id, title, body, priority, dhakaTimestampStr());

  const sync = await maybeSyncSheets(req);
  res.json({ ok: true, id, notices: getPublishedNotices(), ...sync });
});

app.delete('/api/notices/:id', async (req, res) => {
  const ses = getSession(extractToken(req));
  if (!ses || ses.role !== 'admin') {
    res.status(403).json({ ok: false, message: 'Admin permission required.' });
    return;
  }

  const id = String(req.params.id || '').trim();
  db.prepare('DELETE FROM notices WHERE id = ?').run(id);
  const sync = await maybeSyncSheets(req);
  res.json({ ok: true, notices: getPublishedNotices(), ...sync });
});

// Billing-free Google Sheets Integration via Google Apps Script Web App (Admin only)
app.post('/api/sheets/connect', async (req, res) => {
  const ses = getSession(extractToken(req));
  if (!ses || ses.role !== 'admin') {
    res.status(403).json({ ok: false, message: 'Admin permission required.' });
    return;
  }

  const webhookUrl = String(req.body?.webhookUrl || '').trim();
  if (!webhookUrl) {
    res.status(400).json({ ok: false, message: 'Google Apps Script Web App URL দিন।' });
    return;
  }

  try {
    const result = await pushAllDataToAppsScript(webhookUrl);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(400).json({
      ok: false,
      message: err instanceof Error ? err.message : 'Failed to connect Google Sheet.',
    });
  }
});

app.post('/api/sheets/sync', async (req, res) => {
  const ses = getSession(extractToken(req));
  if (!ses || ses.role !== 'admin') {
    res.status(403).json({ ok: false, message: 'Admin permission required.' });
    return;
  }

  try {
    const result = await pushAllDataToAppsScript();
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(400).json({
      ok: false,
      message: err instanceof Error ? err.message : 'Failed to sync with Google Sheets.',
    });
  }
});

app.post('/api/sheets/disconnect', (req, res) => {
  const ses = getSession(extractToken(req));
  if (!ses || ses.role !== 'admin') {
    res.status(403).json({ ok: false, message: 'Admin permission required.' });
    return;
  }

  setSetting('apps_script_url', '');
  setSetting('google_sheet_url', '');
  setSetting('google_sheet_last_sync', '');
  res.json({ ok: true });
});

async function startServer() {
  const distDir = path.resolve(process.cwd(), 'dist');
  const isDevLifecycle =
    process.env.NODE_ENV === 'development' || process.env.npm_lifecycle_event === 'dev';
  const isProd =
    !isDevLifecycle &&
    (process.env.NODE_ENV === 'production' || fs.existsSync(path.join(distDir, 'index.html')));

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, ws: false },
      appType: 'spa',
      plugins: [
        {
          name: 'disable-hmr-websocket-in-preview',
          transform(code, id) {
            if (id.includes('vite/dist/client/client.mjs')) {
              return code.replace(
                /const transport = normalizeModuleRunnerTransport\(\(\(\) => \{[\s\S]*?\}\)\(\)\);/,
                `const transport = normalizeModuleRunnerTransport({ async connect() {}, async disconnect() {}, send() {} });`
              );
            }
          },
        },
      ],
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distDir));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`MUTUAL INVESTMENT-2026 running on http://0.0.0.0:${port}`);
  });
}

startServer();
