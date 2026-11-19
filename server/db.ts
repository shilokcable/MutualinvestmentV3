import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'mutual_investment.db');
export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export const CFG = {
  APP_NAME: 'MUTUAL INVESTMENT-2026',
  TAGLINE: 'Together We Grow',
  TIMEZONE: 'Asia/Dhaka',
  SESSION_TTL: 21600, // 6 hours in seconds
  MAX_MEMBERS: 22,
};

export function dhakaNow(): Date {
  const now = new Date();
  const str = now.toLocaleString('en-US', { timeZone: CFG.TIMEZONE });
  return new Date(str);
}

export function dhakaTodayStr(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CFG.TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year')?.value ?? '2026';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const d = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${y}-${m}-${d}`;
}

export function dhakaTimestampStr(): string {
  const d = dhakaNow();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

export function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      mobile TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Active',
      password TEXT NOT NULL DEFAULT '1234',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      tx_date TEXT NOT NULL,
      member_id TEXT NOT NULL,
      amount REAL NOT NULL,
      type TEXT NOT NULL,
      note TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      FOREIGN KEY (member_id) REFERENCES members(id)
    );

    CREATE TABLE IF NOT EXISTS fdr (
      id TEXT PRIMARY KEY,
      amount REAL NOT NULL,
      fdr_date TEXT NOT NULL,
      tenure INTEGER NOT NULL,
      maturity_date TEXT NOT NULL,
      bank_name TEXT DEFAULT '',
      fdr_no TEXT DEFAULT '',
      return_date TEXT DEFAULT '',
      returned_amount REAL DEFAULT 0,
      ref TEXT DEFAULT '',
      note TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS bank_entries (
      id TEXT PRIMARY KEY,
      entry_date TEXT NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      reference TEXT DEFAULT '',
      note TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS kyc (
      member_id TEXT PRIMARY KEY,
      shareholder_name TEXT DEFAULT '',
      nid_number TEXT DEFAULT '',
      dob TEXT DEFAULT '',
      father_name TEXT DEFAULT '',
      mother_name TEXT DEFAULT '',
      spouse_name TEXT DEFAULT '',
      marital_status TEXT DEFAULT '',
      profession TEXT DEFAULT '',
      email TEXT DEFAULT '',
      bd_phone TEXT DEFAULT '',
      whatsapp TEXT DEFAULT '',
      overseas_phone TEXT DEFAULT '',
      tin_number TEXT DEFAULT '',
      passport_number TEXT DEFAULT '',
      permanent_address TEXT DEFAULT '',
      present_address TEXT DEFAULT '',
      nominee_name TEXT DEFAULT '',
      nominee_nid TEXT DEFAULT '',
      nominee_dob TEXT DEFAULT '',
      nominee_relation TEXT DEFAULT '',
      nominee_phone TEXT DEFAULT '',
      nominee_address TEXT DEFAULT '',
      shareholder_nid_front TEXT DEFAULT '',
      shareholder_nid_back TEXT DEFAULT '',
      member_photo TEXT DEFAULT '',
      tin_certificate TEXT DEFAULT '',
      passport_copy TEXT DEFAULT '',
      nominee_nid_front TEXT DEFAULT '',
      nominee_nid_back TEXT DEFAULT '',
      nominee_photo TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      submitted_at TEXT DEFAULT '',
      status TEXT DEFAULT 'Pending',
      update_permission TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS kyc_requests (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL,
      member_name TEXT NOT NULL,
      request TEXT NOT NULL,
      request_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Pending',
      approved_date TEXT DEFAULT '',
      admin_note TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS notices (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'Normal',
      published INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      member_id TEXT DEFAULT '',
      expires_at INTEGER NOT NULL
    );
  `);

  // Seed initial settings if empty
  const existingPin = db.prepare('SELECT value FROM settings WHERE key = ?').get('admin_pin');
  if (!existingPin) {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('admin_pin', '2026');
  }
  const existingOpening = db.prepare('SELECT value FROM settings WHERE key = ?').get('opening_balance');
  if (!existingOpening) {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('opening_balance', '0');
  }

  // One-time cleanup: remove all previously seeded demo IDs & demo transactions/FDR
  const demoPurged = db.prepare('SELECT value FROM settings WHERE key = ?').get('demo_purged_v1');
  if (!demoPurged) {
    const cleanup = db.transaction(() => {
      const demoIds = ['MI-01', 'MI-02', 'MI-03', 'MI-04', 'MI-05'];
      const placeholders = demoIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM sessions WHERE UPPER(member_id) IN (${placeholders})`).run(...demoIds);
      db.prepare(`DELETE FROM kyc_requests WHERE UPPER(member_id) IN (${placeholders})`).run(...demoIds);
      db.prepare(`DELETE FROM kyc WHERE UPPER(member_id) IN (${placeholders})`).run(...demoIds);
      db.prepare(`DELETE FROM transactions WHERE UPPER(member_id) IN (${placeholders})`).run(...demoIds);
      db.prepare(`DELETE FROM members WHERE UPPER(id) IN (${placeholders})`).run(...demoIds);
      db.prepare(`DELETE FROM fdr WHERE id = ? AND fdr_no = ?`).run('FDR-001', 'IBBL-88201');
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('demo_purged_v1', '1');
    });
    cleanup();
  }
}

export function createSession(role: 'member' | 'admin', memberId = ''): string {
  const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  const expiresAt = Math.floor(Date.now() / 1000) + CFG.SESSION_TTL;
  db.prepare('INSERT INTO sessions (token, role, member_id, expires_at) VALUES (?, ?, ?, ?)').run(
    token,
    role,
    memberId,
    expiresAt
  );
  // prune expired
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Math.floor(Date.now() / 1000));
  return token;
}

export function getSession(token: string): { role: 'member' | 'admin'; memberId: string } | null {
  if (!token) return null;
  const nowSec = Math.floor(Date.now() / 1000);
  const row = db
    .prepare('SELECT role, member_id, expires_at FROM sessions WHERE token = ?')
    .get(token) as { role: 'member' | 'admin'; member_id: string; expires_at: number } | undefined;
  if (!row || row.expires_at < nowSec) {
    if (row) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }
  return { role: row.role, memberId: row.member_id };
}

export function deleteSession(token: string) {
  if (token) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }
}

export interface MemberRow {
  id: string;
  name: string;
  mobile: string;
  status: string;
  password: string;
  created_at: string;
}

export interface TxRow {
  id: string;
  tx_date: string;
  member_id: string;
  amount: number;
  type: string;
  note: string;
  created_at: string;
}

export interface FdrRow {
  id: string;
  amount: number;
  fdr_date: string;
  tenure: number;
  maturity_date: string;
  bank_name: string;
  fdr_no: string;
  return_date: string;
  returned_amount: number;
  ref: string;
  note: string;
}

export interface BankEntryRow {
  id: string;
  entry_date: string;
  type: string;
  amount: number;
  reference: string;
  note: string;
  created_at: string;
}

export interface NoticeRow {
  id: string;
  title: string;
  body: string;
  priority: string;
  published: number;
  created_at: string;
}

export function getSetting(key: string, fallback = ''): string {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? fallback;
}

export function setSetting(key: string, value: string) {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

export function computeAccounts() {
  const opening = Number(getSetting('opening_balance', '0') || 0);

  const txRows = db.prepare('SELECT * FROM transactions').all() as TxRow[];
  const memberNet = txRows.reduce((sum, x) => {
    const amt = Number(x.amount || 0);
    return sum + (x.type === 'Withdrawal' ? -amt : amt);
  }, 0);

  const bankRows = db.prepare('SELECT * FROM bank_entries').all() as BankEntryRow[];
  const bankNet = bankRows.reduce((sum, x) => {
    const amt = Number(x.amount || 0);
    const credit = x.type === 'Bank Credit' || x.type === 'Other Credit';
    return sum + (credit ? amt : -amt);
  }, 0);

  const fdrRows = db.prepare('SELECT * FROM fdr').all() as FdrRow[];
  const todayStr = dhakaTodayStr();

  let placed = 0;
  let returned = 0;
  let activeFdr = 0;
  let activeCount = 0;
  let pendingFdr = 0;

  const fdrList = fdrRows
    .map((f) => {
      const amount = Number(f.amount || 0);
      const retAmt = Number(f.returned_amount || 0);
      placed += amount;
      if (f.return_date) {
        returned += retAmt;
      }
      const status = f.return_date
        ? 'Returned'
        : f.maturity_date && f.maturity_date < todayStr
        ? 'Maturity Pending'
        : 'Active';
      if (status !== 'Returned') {
        activeFdr += amount;
        activeCount++;
      }
      if (status === 'Maturity Pending') {
        pendingFdr++;
      }
      return {
        id: f.id,
        amount,
        date: f.fdr_date,
        tenure: f.tenure,
        maturity: f.maturity_date,
        bank: f.bank_name,
        no: f.fdr_no,
        status,
        returnDate: f.return_date || '',
        returned: retAmt,
        ref: f.ref || '',
        note: f.note || '',
      };
    })
    .reverse();

  const mainBank = opening + memberNet + bankNet - placed + returned;
  const totalInstitutional = mainBank + activeFdr;

  return {
    opening,
    memberNet,
    bankNet,
    placed,
    returned,
    fdrBalance: activeFdr,
    activeFdr: activeCount,
    pendingFdr,
    mainBank,
    totalInstitutional,
    fdrList,
  };
}

export function memberNetDeposit(memberId: string): number {
  const rows = db
    .prepare('SELECT amount, type FROM transactions WHERE UPPER(member_id) = UPPER(?)')
    .all(memberId) as { amount: number; type: string }[];
  return rows.reduce(
    (sum, x) => sum + (x.type === 'Withdrawal' ? -Number(x.amount || 0) : Number(x.amount || 0)),
    0
  );
}

export function addMonthsToDateStr(dateStr: string, months: number): string {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return dateStr;
  const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}
