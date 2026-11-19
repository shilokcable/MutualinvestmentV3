import { useEffect, useMemo, useState } from 'react';
import {
  LogOut,
  Users,
  Landmark,
  FileCheck2,
  LayoutDashboard,
  Plus,
  Search,
  FileDown,
  Eye,
  Edit3,
  Settings,
  Wallet,
  TrendingUp,
  Building2,
  CalendarCheck,
  Layers,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  Megaphone,
  FileSpreadsheet,
  Trash2,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  BellRing,
  Link2,
  Unlink,
  X,
  Copy,
  Check,
  Code2,
} from 'lucide-react';
import type { AdminDashboardData, KycRequestItem, MemberSummary } from '../types';
import { dhakaToday, money } from '../utils/format';
import { api } from '../api';
import { generateStatementPdf } from '../utils/pdfGenerator';
import { PWAInstallButton } from './PWAInstallButton';

const APPS_SCRIPT_CODE = `function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents || '{}');
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetsData = payload.sheets || {};
    var names = Object.keys(sheetsData);
    for (var i = 0; i < names.length; i++) {
      var name = names[i];
      var rows = sheetsData[name];
      if (!rows || !rows.length) continue;
      var sh = ss.getSheetByName(name) || ss.insertSheet(name);
      sh.clearContents();
      sh.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
      sh.getRange(1, 1, 1, rows[0].length).setFontWeight('bold').setBackground('#eef5ff');
      sh.setFrozenRows(1);
    }
    return ContentService.createTextOutput(JSON.stringify({
      ok: true,
      title: ss.getName(),
      spreadsheetUrl: ss.getUrl()
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      ok: false,
      message: String(err)
    })).setMimeType(ContentService.MimeType.JSON);
  }
}`;

interface AdminDashboardProps {
  data: AdminDashboardData;
  token: string;
  onRefresh: () => void;
  onEditMember: (member: MemberSummary) => void;
  onAddMember: () => void;
  onReviewKyc: (item: KycRequestItem, action: 'Approved' | 'Rejected') => void;
  onViewMemberKyc: (memberId: string) => void;
  onOpenAndroidGuide: () => void;
  onLogout: () => void;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

type AdminTab = 'overview' | 'members' | 'fdr' | 'kyc' | 'notices';

type PendingSheetConfirm =
  | { kind: 'connect'; webhookUrl: string }
  | { kind: 'sync' }
  | { kind: 'disconnect' }
  | null;

export function AdminDashboard({
  data,
  token,
  onRefresh,
  onEditMember,
  onAddMember,
  onReviewKyc,
  onViewMemberKyc,
  onOpenAndroidGuide,
  onLogout,
  onNotify,
}: AdminDashboardProps) {
  const [tab, setTab] = useState<AdminTab>('overview');
  const today = dhakaToday();

  // Transaction Form
  const [txDate, setTxDate] = useState(today);
  const [txType, setTxType] = useState('Monthly Deposit');
  const [txMember, setTxMember] = useState(data.members[0]?.id || '');
  const [txAmount, setTxAmount] = useState('');
  const [txNote, setTxNote] = useState('');
  const [txBusy, setTxBusy] = useState(false);

  // Sync selected member when member list loads/changes
  useEffect(() => {
    if (data.members.length > 0 && !data.members.some((m) => m.id === txMember)) {
      setTxMember(data.members[0].id);
    }
  }, [data.members, txMember]);

  // Create FDR Form
  const [fdrDate, setFdrDate] = useState(today);
  const [fdrAmount, setFdrAmount] = useState('');
  const [fdrTenure, setFdrTenure] = useState('');
  const [fdrBank, setFdrBank] = useState('');
  const [fdrNo, setFdrNo] = useState('');
  const [fdrRef, setFdrRef] = useState('');
  const [fdrBusy, setFdrBusy] = useState(false);

  // Return FDR Form
  const activeFdrs = useMemo(
    () => data.fdrList.filter((f) => f.status !== 'Returned'),
    [data.fdrList]
  );
  const [returnFdrId, setReturnFdrId] = useState(activeFdrs[0]?.id || '');
  const [returnDate, setReturnDate] = useState(today);
  const [returnAmount, setReturnAmount] = useState('');
  const [returnRef, setReturnRef] = useState('');
  const [retBusy, setRetBusy] = useState(false);

  // Bank Account Entry Form
  const [bankDate, setBankDate] = useState(today);
  const [bankType, setBankType] = useState('Bank Credit');
  const [bankAmount, setBankAmount] = useState('');
  const [bankRef, setBankRef] = useState('');
  const [bankNote, setBankNote] = useState('');
  const [bankBusy, setBankBusy] = useState(false);

  // Settings Form
  const [openingBal, setOpeningBal] = useState(String(data.openingBalance ?? 0));
  const [newPin, setNewPin] = useState('');
  const [setBusy, setSetBusy] = useState(false);

  // Notice Publisher Form
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticePriority, setNoticePriority] = useState('Normal');
  const [noticeBody, setNoticeBody] = useState('');
  const [noticeBusy, setNoticeBusy] = useState(false);

  // Google Apps Script Webhook Sync State (100% Free, Zero Billing)
  const [webhookInput, setWebhookInput] = useState(data.sheetConfig?.webhookUrl || '');
  const [showScriptCode, setShowScriptCode] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [sheetBusy, setSheetBusy] = useState(false);
  const [confirmModal, setConfirmModal] = useState<PendingSheetConfirm>(null);

  // Search filters
  const [memberSearch, setMemberSearch] = useState('');
  const [txSearch, setTxSearch] = useState('');

  const pendingReqCount = useMemo(
    () => data.kycRequests.filter((r) => r.status === 'Pending').length,
    [data.kycRequests]
  );

  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return data.members;
    return data.members.filter(
      (m) =>
        m.id.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q) ||
        (m.mobile || '').toLowerCase().includes(q)
    );
  }, [data.members, memberSearch]);

  const filteredTx = useMemo(() => {
    const q = txSearch.trim().toLowerCase();
    if (!q) return data.recent;
    return data.recent.filter(
      (t) =>
        (t.memberId || '').toLowerCase().includes(q) ||
        (t.name || '').toLowerCase().includes(q) ||
        t.type.toLowerCase().includes(q) ||
        (t.note || '').toLowerCase().includes(q) ||
        t.date.toLowerCase().includes(q)
    );
  }, [data.recent, txSearch]);

  const notifySyncOutcome = (baseMsg: string, res: { sheetSynced?: boolean; sheetError?: string }) => {
    if (res.sheetSynced) {
      onNotify(`${baseMsg} · Synced to Google Sheets`);
    } else if (res.sheetError) {
      onNotify(`${baseMsg} (Sheet sync warning: ${res.sheetError})`, 'error');
    } else {
      onNotify(baseMsg);
    }
  };

  const handleSaveTx = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetMember = txMember || data.members[0]?.id || '';
    if (!targetMember) {
      onNotify('আগে Members ট্যাব থেকে সদস্য যোগ করুন।', 'error');
      return;
    }
    const amt = Number(txAmount);
    if (!amt || amt <= 0) {
      onNotify('সঠিক টাকার পরিমাণ দিন।', 'error');
      return;
    }
    setTxBusy(true);
    try {
      const res = await api.saveTransaction(token, {
        date: txDate || today,
        memberId: targetMember,
        amount: amt,
        type: txType,
        note: txNote.trim(),
      });
      setTxAmount('');
      setTxNote('');
      notifySyncOutcome('Transaction saved', res);
      onRefresh();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Save error', 'error');
    } finally {
      setTxBusy(false);
    }
  };

  const handleSaveFdr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fdrDate) return onNotify('FDR Date দিন।', 'error');
    if (Number(fdrAmount) <= 0) return onNotify('FDR Amount দিন।', 'error');
    if (Number(fdrTenure) <= 0) return onNotify('Tenure (months) দিন।', 'error');

    setFdrBusy(true);
    try {
      const res = await api.saveFdr(token, {
        date: fdrDate,
        amount: Number(fdrAmount),
        tenure: Number(fdrTenure),
        bank: fdrBank.trim(),
        fdrNo: fdrNo.trim(),
        ref: fdrRef.trim(),
      });
      setFdrAmount('');
      setFdrTenure('');
      setFdrBank('');
      setFdrNo('');
      setFdrRef('');
      notifySyncOutcome('FDR created: ' + res.id, res);
      onRefresh();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'FDR error', 'error');
    } finally {
      setFdrBusy(false);
    }
  };

  const handleReturnFdr = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = returnFdrId || activeFdrs[0]?.id || '';
    if (!targetId) return onNotify('কোনো Active FDR নেই।', 'error');
    if (Number(returnAmount) <= 0) return onNotify('Returned Amount দিন।', 'error');

    setRetBusy(true);
    try {
      const res = await api.returnFdr(token, {
        fdrId: targetId,
        returnDate: returnDate || today,
        returnedAmount: Number(returnAmount),
        ref: returnRef.trim(),
      });
      setReturnAmount('');
      setReturnRef('');
      notifySyncOutcome('FDR returned to Main Bank', res);
      onRefresh();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Return FDR error', 'error');
    } finally {
      setRetBusy(false);
    }
  };

  const handleBankEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (Number(bankAmount) <= 0) return onNotify('সঠিক amount দিন।', 'error');

    setBankBusy(true);
    try {
      const res = await api.saveBankEntry(token, {
        date: bankDate || today,
        type: bankType,
        amount: Number(bankAmount),
        ref: bankRef.trim(),
        note: bankNote.trim(),
      });
      setBankAmount('');
      setBankRef('');
      setBankNote('');
      notifySyncOutcome('Bank entry saved', res);
      onRefresh();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Bank entry error', 'error');
    } finally {
      setBankBusy(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetBusy(true);
    try {
      const res = await api.updateSettings(token, {
        openingBalance: Number(openingBal || 0),
        newPin: newPin.trim() || undefined,
      });
      setNewPin('');
      notifySyncOutcome('Settings updated', res);
      onRefresh();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Settings error', 'error');
    } finally {
      setSetBusy(false);
    }
  };

  const handleCreateNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noticeTitle.trim() || !noticeBody.trim()) {
      onNotify('Notice Title এবং বিবরণ লিখুন।', 'error');
      return;
    }
    setNoticeBusy(true);
    try {
      const res = await api.createNotice(token, {
        title: noticeTitle.trim(),
        body: noticeBody.trim(),
        priority: noticePriority,
      });
      setNoticeTitle('');
      setNoticeBody('');
      setNoticePriority('Normal');
      notifySyncOutcome('Notice published on main portal', res);
      onRefresh();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Notice error', 'error');
    } finally {
      setNoticeBusy(false);
    }
  };

  const handleDeleteNotice = async (id: string) => {
    try {
      const res = await api.deleteNotice(token, id);
      notifySyncOutcome('Notice removed', res);
      onRefresh();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Delete failed', 'error');
    }
  };

  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(APPS_SCRIPT_CODE);
      setCopiedScript(true);
      onNotify('Apps Script কোড কপি হয়েছে!');
      setTimeout(() => setCopiedScript(false), 2500);
    } catch {
      setShowScriptCode(true);
      onNotify('নিচের বক্স থেকে কোডটি কপি করুন।');
    }
  };

  const executeConfirmedSheetAction = async () => {
    if (!confirmModal) return;
    setSheetBusy(true);
    try {
      if (confirmModal.kind === 'connect') {
        const res = await api.connectGoogleSheet(token, confirmModal.webhookUrl);
        onNotify(`Google Sheet connected & synced (${res.rowsSynced ?? 0} rows)`);
      } else if (confirmModal.kind === 'sync') {
        const res = await api.syncGoogleSheet(token);
        onNotify(`All data synced to Google Sheets (${res.rowsSynced ?? 0} rows)`);
      } else if (confirmModal.kind === 'disconnect') {
        await api.disconnectGoogleSheet(token);
        setWebhookInput('');
        onNotify('Google Sheet disconnected from app');
      }
      setConfirmModal(null);
      onRefresh();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Google Sheet sync failed', 'error');
    } finally {
      setSheetBusy(false);
    }
  };

  const handleMemberStatement = async (memberId: string) => {
    try {
      const stmt = await api.getStatement(token, memberId);
      await generateStatementPdf(stmt);
      onNotify(`${memberId} Single-Page Statement downloaded`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Statement error', 'error');
    }
  };

  const inputCls =
    'w-full min-h-[42px] px-3 py-2 rounded-xl border border-[#d6e0ee] bg-white text-sm text-[#13294b] focus:outline-none focus:ring-2 focus:ring-[#0b3d91]/20 focus:border-[#0b3d91]';
  const fieldLabelCls = 'block text-[11px] font-semibold text-[#5b6b82] mb-1';

  const sheetCfg = data.sheetConfig;
  const hasConnectedSheet = Boolean(sheetCfg?.webhookUrl);

  return (
    <div className="min-h-screen pb-24 md:pb-12 bg-[#f6f8fc]">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#e2e8f2] no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/logo.jpg"
              alt="MUTUAL INVESTMENT-2026"
              className="h-9 w-auto object-contain shrink-0"
            />
            <span className="hidden sm:inline text-xs text-[#64748b] truncate">
              Admin Control Console ·{' '}
              <span className="font-mono-num font-semibold text-[#0b3d91]">
                {data.memberCount}/{data.maxMembers}
              </span>{' '}
              Members
            </span>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <div className="hidden sm:block">
              <PWAInstallButton onOpenAndroidGuide={onOpenAndroidGuide} compact />
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="min-h-[42px] px-4 rounded-xl bg-[#f1f5fb] hover:bg-[#e5edf9] text-[#0b3d91] font-semibold text-xs sm:text-sm inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>

        {/* Desktop Sub-navigation Tabs */}
        <div className="hidden md:block border-t border-[#edf2f8] bg-[#fbfcfe]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-1 overflow-x-auto">
            {(
              [
                ['overview', 'Overview & Entry', LayoutDashboard],
                ['members', `Members (${data.memberCount})`, Users],
                ['fdr', `FDR & Bank (${data.fdrList.length})`, Landmark],
                ['kyc', `KYC Requests${pendingReqCount ? ` (${pendingReqCount})` : ''}`, FileCheck2],
                ['notices', `Notices & Sheets (${data.notices?.length || 0})`, FileSpreadsheet],
              ] as const
            ).map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`min-h-[44px] px-4 text-xs sm:text-sm font-semibold inline-flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                  tab === key
                    ? 'border-[#0b3d91] text-[#0b3d91] bg-white'
                    : 'border-transparent text-[#64748b] hover:text-[#13294b]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Modernized Categorized KPI Strip with Symbols */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="bg-white border border-[#dce4f0] rounded-2xl p-4 sm:p-5 flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-medium text-[#64748b]">মোট সদস্য (Shareholders)</div>
              <div className="font-mono-num text-2xl font-bold text-[#0b3d91] mt-1.5">
                {data.memberCount}{' '}
                <span className="text-xs font-normal text-[#64748b]">/ {data.maxMembers}</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#eef4ff] text-[#0b3d91] flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white border border-[#dce4f0] rounded-2xl p-4 sm:p-5 flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-medium text-[#64748b]">মোট সদস্যের নেট জমা</div>
              <div className="font-mono-num text-2xl font-bold text-[#0f9f59] mt-1.5">
                ৳ {money(data.totalDeposit)}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#eefbf3] text-[#0f9f59] flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white border border-[#dce4f0] rounded-2xl p-4 sm:p-5 flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-medium text-[#64748b]">Main Bank Balance</div>
              <div className="font-mono-num text-2xl font-bold text-[#0b3d91] mt-1.5">
                ৳ {money(data.mainBank)}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#eef4ff] text-[#0b3d91] flex items-center justify-center shrink-0">
              <Landmark className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white border border-[#dce4f0] rounded-2xl p-4 sm:p-5 flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-medium text-[#64748b]">FDR Balance</div>
              <div className="font-mono-num text-2xl font-bold text-[#b45309] mt-1.5">
                ৳ {money(data.fdrBalance)}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-[#b45309] flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white border border-[#dce4f0] rounded-2xl p-4 sm:p-5 flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-medium text-[#64748b]">Total Institutional Funds</div>
              <div className="font-mono-num text-xl font-bold text-[#0f9f59] mt-1.5">
                ৳ {money(data.totalInstitutional)}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#eefbf3] text-[#0f9f59] flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white border border-[#dce4f0] rounded-2xl p-4 sm:p-5 flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-medium text-[#64748b]">এই মাসের নেট জমা</div>
              <div className="font-mono-num text-xl font-bold text-[#0b3d91] mt-1.5">
                ৳ {money(data.thisMonth)}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#eef4ff] text-[#0b3d91] flex items-center justify-center shrink-0">
              <CalendarCheck className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white border border-[#dce4f0] rounded-2xl p-4 sm:p-5 flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-medium text-[#64748b]">Active FDR</div>
              <div className="font-mono-num text-xl font-bold text-[#0f2444] mt-1.5">
                {data.activeFdr}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#f1f5fb] text-[#0b3d91] flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white border border-[#dce4f0] rounded-2xl p-4 sm:p-5 flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-medium text-[#64748b]">Maturity Pending</div>
              <div className="font-mono-num text-xl font-bold text-[#b45309] mt-1.5">
                {data.pendingFdr}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-[#b45309] flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        </section>

        {/* OVERVIEW & QUICK ENTRY */}
        {tab === 'overview' && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Transaction Entry */}
              <form
                onSubmit={handleSaveTx}
                className="bg-white border border-[#dce4f0] rounded-2xl p-5 sm:p-6 space-y-4"
              >
                <div className="flex items-baseline justify-between gap-2 pb-2 border-b border-[#edf2f8]">
                  <h3 className="font-display text-base font-bold text-[#0f2444] flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-[#0b3d91]" />
                    নতুন Deposit / Withdrawal
                  </h3>
                  <span className="text-xs text-[#64748b]">Member transaction</span>
                </div>

                {data.members.length === 0 ? (
                  <div className="p-4 rounded-xl bg-[#f8fafd] border border-[#e2e8f2] text-xs sm:text-sm text-[#475569] flex flex-wrap items-center justify-between gap-3">
                    <span>এখনও কোনো সদস্য যোগ করা হয়নি। লেনদেন এন্ট্রির আগে সদস্য যোগ করুন।</span>
                    <button
                      type="button"
                      onClick={onAddMember}
                      className="min-h-[38px] px-3.5 rounded-lg bg-[#0f9f59] hover:bg-[#0c854a] text-white text-xs font-semibold inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add First Member
                    </button>
                  </div>
                ) : null}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={fieldLabelCls}>Date</label>
                    <input
                      type="date"
                      className={inputCls}
                      value={txDate}
                      onChange={(e) => setTxDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={fieldLabelCls}>Transaction Type</label>
                    <select
                      className={inputCls}
                      value={txType}
                      onChange={(e) => setTxType(e.target.value)}
                    >
                      <option>Monthly Deposit</option>
                      <option>Special Deposit</option>
                      <option>Withdrawal</option>
                    </select>
                  </div>
                  <div>
                    <label className={fieldLabelCls}>Member</label>
                    <select
                      className={inputCls}
                      value={txMember}
                      onChange={(e) => setTxMember(e.target.value)}
                      disabled={data.members.length === 0}
                    >
                      {data.members.length === 0 ? (
                        <option value="">No members registered</option>
                      ) : (
                        data.members.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.id} — {m.name}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                  <div>
                    <label className={fieldLabelCls}>Amount (৳)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className={`${inputCls} font-mono-num`}
                      value={txAmount}
                      onChange={(e) => setTxAmount(e.target.value)}
                      placeholder="15000"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={fieldLabelCls}>Note / Bank Reference</label>
                    <input
                      type="text"
                      className={inputCls}
                      value={txNote}
                      onChange={(e) => setTxNote(e.target.value)}
                      placeholder="Monthly installment or bank transfer ref"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={txBusy || data.members.length === 0}
                  className="min-h-[44px] px-5 rounded-xl bg-[#0b3d91] hover:bg-[#082e6e] disabled:opacity-50 text-white font-semibold text-sm transition-colors"
                >
                  {txBusy ? 'Saving...' : 'Save Transaction'}
                </button>
              </form>

              {/* Create Institutional FDR */}
              <form
                onSubmit={handleSaveFdr}
                className="bg-white border border-[#dce4f0] rounded-2xl p-5 sm:p-6 space-y-4"
              >
                <div className="flex items-baseline justify-between gap-2 pb-2 border-b border-[#edf2f8]">
                  <h3 className="font-display text-base font-bold text-[#0f2444] flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#0f9f59]" />
                    Institutional FDR
                  </h3>
                  <span className="text-xs text-[#64748b]">In MUTUAL INVESTMENT name</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={fieldLabelCls}>Start Date</label>
                    <input
                      type="date"
                      className={inputCls}
                      value={fdrDate}
                      onChange={(e) => setFdrDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={fieldLabelCls}>FDR Amount (৳)</label>
                    <input
                      type="number"
                      min="0"
                      className={`${inputCls} font-mono-num`}
                      value={fdrAmount}
                      onChange={(e) => setFdrAmount(e.target.value)}
                      placeholder="100000"
                    />
                  </div>
                  <div>
                    <label className={fieldLabelCls}>Tenure (Months)</label>
                    <input
                      type="number"
                      min="1"
                      className={`${inputCls} font-mono-num`}
                      value={fdrTenure}
                      onChange={(e) => setFdrTenure(e.target.value)}
                      placeholder="6"
                    />
                  </div>
                  <div>
                    <label className={fieldLabelCls}>Bank Name</label>
                    <input
                      type="text"
                      className={inputCls}
                      value={fdrBank}
                      onChange={(e) => setFdrBank(e.target.value)}
                      placeholder="Dutch-Bangla Bank"
                    />
                  </div>
                  <div>
                    <label className={fieldLabelCls}>FDR Number</label>
                    <input
                      type="text"
                      className={`${inputCls} font-mono-num`}
                      value={fdrNo}
                      onChange={(e) => setFdrNo(e.target.value)}
                      placeholder="FDR-2026-01"
                    />
                  </div>
                  <div>
                    <label className={fieldLabelCls}>Reference</label>
                    <input
                      type="text"
                      className={inputCls}
                      value={fdrRef}
                      onChange={(e) => setFdrRef(e.target.value)}
                      placeholder="Approval reference"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={fdrBusy}
                  className="min-h-[44px] px-5 rounded-xl bg-[#0f9f59] hover:bg-[#0c854a] text-white font-semibold text-sm transition-colors"
                >
                  {fdrBusy ? 'Creating...' : 'Create FDR'}
                </button>
              </form>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* FDR Return */}
              <form
                onSubmit={handleReturnFdr}
                className="bg-white border border-[#dce4f0] rounded-2xl p-5 sm:p-6 space-y-4"
              >
                <div className="flex items-baseline justify-between gap-2 pb-2 border-b border-[#edf2f8]">
                  <h3 className="font-display text-base font-bold text-[#0f2444] flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#b45309]" />
                    FDR Maturity / Return
                  </h3>
                  <span className="text-xs text-[#64748b]">Credits Main Bank Balance</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={fieldLabelCls}>Select Active FDR</label>
                    <select
                      className={inputCls}
                      value={returnFdrId || activeFdrs[0]?.id || ''}
                      onChange={(e) => setReturnFdrId(e.target.value)}
                    >
                      {activeFdrs.length === 0 ? (
                        <option value="">No Active FDR</option>
                      ) : (
                        activeFdrs.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.id} — ৳ {money(f.amount)} — {f.status}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                  <div>
                    <label className={fieldLabelCls}>Return Date</label>
                    <input
                      type="date"
                      className={inputCls}
                      value={returnDate}
                      onChange={(e) => setReturnDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={fieldLabelCls}>Returned Amount (৳)</label>
                    <input
                      type="number"
                      min="0"
                      className={`${inputCls} font-mono-num`}
                      value={returnAmount}
                      onChange={(e) => setReturnAmount(e.target.value)}
                      placeholder="Principal + Profit"
                    />
                  </div>
                  <div>
                    <label className={fieldLabelCls}>Bank Reference</label>
                    <input
                      type="text"
                      className={inputCls}
                      value={returnRef}
                      onChange={(e) => setReturnRef(e.target.value)}
                      placeholder="Settlement receipt"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={retBusy || activeFdrs.length === 0}
                  className="min-h-[44px] px-5 rounded-xl bg-[#b45309] hover:bg-[#92400e] disabled:opacity-50 text-white font-semibold text-sm transition-colors"
                >
                  {retBusy ? 'Saving...' : 'Save FDR Return'}
                </button>
              </form>

              {/* Bank Account Entry */}
              <form
                onSubmit={handleBankEntry}
                className="bg-white border border-[#dce4f0] rounded-2xl p-5 sm:p-6 space-y-4"
              >
                <div className="flex items-baseline justify-between gap-2 pb-2 border-b border-[#edf2f8]">
                  <h3 className="font-display text-base font-bold text-[#0f2444] flex items-center gap-2">
                    <Landmark className="w-4 h-4 text-[#0b3d91]" />
                    Bank Credit / Expense Entry
                  </h3>
                  <span className="text-xs text-[#64748b]">Adjusts Main Bank Balance</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={fieldLabelCls}>Date</label>
                    <input
                      type="date"
                      className={inputCls}
                      value={bankDate}
                      onChange={(e) => setBankDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={fieldLabelCls}>Entry Type</label>
                    <select
                      className={inputCls}
                      value={bankType}
                      onChange={(e) => setBankType(e.target.value)}
                    >
                      <option>Bank Credit</option>
                      <option>Other Credit</option>
                      <option>Withdrawal</option>
                      <option>Other Expense</option>
                    </select>
                  </div>
                  <div>
                    <label className={fieldLabelCls}>Amount (৳)</label>
                    <input
                      type="number"
                      min="0"
                      className={`${inputCls} font-mono-num`}
                      value={bankAmount}
                      onChange={(e) => setBankAmount(e.target.value)}
                      placeholder="5000"
                    />
                  </div>
                  <div>
                    <label className={fieldLabelCls}>Reference</label>
                    <input
                      type="text"
                      className={inputCls}
                      value={bankRef}
                      onChange={(e) => setBankRef(e.target.value)}
                      placeholder="Voucher / Ref"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={fieldLabelCls}>Description / Note</label>
                    <input
                      type="text"
                      className={inputCls}
                      value={bankNote}
                      onChange={(e) => setBankNote(e.target.value)}
                      placeholder="Bank Profit / Charge / Expense Note"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={bankBusy}
                  className="min-h-[44px] px-5 rounded-xl bg-[#0b3d91] hover:bg-[#082e6e] text-white font-semibold text-sm transition-colors"
                >
                  {bankBusy ? 'Saving...' : 'Save Bank Entry'}
                </button>
              </form>
            </div>

            {/* Recent Transactions */}
            <section className="bg-white border border-[#dce4f0] rounded-2xl p-5 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <h3 className="font-display text-base font-bold text-[#0f2444]">
                  Recent Transactions
                </h3>
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-[#64748b] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={txSearch}
                    onChange={(e) => setTxSearch(e.target.value)}
                    placeholder="Filter member or note..."
                    className="w-full min-h-[40px] pl-9 pr-3 rounded-xl border border-[#d6e0ee] text-xs sm:text-sm focus:outline-none focus:border-[#0b3d91]"
                  />
                </div>
              </div>

              {!filteredTx.length ? (
                <div className="py-10 text-center text-sm text-[#64748b]">No transactions yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-[#f8fafd] text-left text-[11px] font-semibold uppercase tracking-[0.04em] text-[#5b6b82] border-y border-[#e2e8f2]">
                        <th className="py-3 px-3.5">Date</th>
                        <th className="py-3 px-3.5">Member</th>
                        <th className="py-3 px-3.5">Name</th>
                        <th className="py-3 px-3.5">Type</th>
                        <th className="py-3 px-3.5 text-right">Amount</th>
                        <th className="py-3 px-3.5">Note</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#edf2f8]">
                      {filteredTx.map((t, idx) => {
                        const isWd = t.type === 'Withdrawal';
                        return (
                          <tr key={t.id || idx} className="hover:bg-[#f9fbff] transition-colors">
                            <td className="py-3 px-3.5 font-mono-num text-xs text-[#475569] whitespace-nowrap">
                              {t.date}
                            </td>
                            <td className="py-3 px-3.5 font-mono-num font-semibold text-xs text-[#0b3d91]">
                              {t.memberId}
                            </td>
                            <td className="py-3 px-3.5 whitespace-nowrap text-[#13294b]">{t.name}</td>
                            <td className="py-3 px-3.5 whitespace-nowrap text-[#475569]">
                              <span className="inline-flex items-center gap-1.5">
                                {isWd ? (
                                  <ArrowUpRight className="w-3.5 h-3.5 text-red-600" />
                                ) : (
                                  <ArrowDownLeft className="w-3.5 h-3.5 text-[#0f9f59]" />
                                )}
                                {t.type}
                              </span>
                            </td>
                            <td
                              className={`py-3 px-3.5 font-mono-num font-semibold text-right whitespace-nowrap ${
                                isWd ? 'text-red-600' : 'text-[#0f9f59]'
                              }`}
                            >
                              {isWd ? '−' : '+'}৳ {money(t.amount)}
                            </td>
                            <td className="py-3 px-3.5 text-xs text-[#64748b]">{t.note || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Admin Settings */}
            <form
              onSubmit={handleSaveSettings}
              className="bg-white border border-[#dce4f0] rounded-2xl p-5 sm:p-6"
            >
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-[#edf2f8]">
                <Settings className="w-4 h-4 text-[#0b3d91]" />
                <h3 className="font-display text-base font-bold text-[#0f2444]">System Settings</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div>
                  <label className={fieldLabelCls}>Opening Bank Balance (৳)</label>
                  <input
                    type="number"
                    className={`${inputCls} font-mono-num`}
                    value={openingBal}
                    onChange={(e) => setOpeningBal(e.target.value)}
                  />
                </div>
                <div>
                  <label className={fieldLabelCls}>Change Admin PIN (optional)</label>
                  <input
                    type="password"
                    className={inputCls}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
                    placeholder="Min 4 chars"
                  />
                </div>
                <button
                  type="submit"
                  disabled={setBusy}
                  className="min-h-[42px] px-5 rounded-xl bg-[#f1f5fb] hover:bg-[#e5edf9] text-[#0b3d91] border border-[#d6e0ee] font-semibold text-sm transition-colors"
                >
                  {setBusy ? 'Saving...' : 'Update Settings'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* MEMBERS DIRECTORY */}
        {tab === 'members' && (
          <section className="bg-white border border-[#dce4f0] rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="font-display text-base sm:text-lg font-bold text-[#0f2444]">
                  Shareholder Directory
                </h3>
                <p className="text-xs text-[#64748b] mt-0.5">
                  Manage profiles, inspect 6-step KYC dossiers, and export A4 statements
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 sm:w-56">
                  <Search className="w-4 h-4 text-[#64748b] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder="Search ID, name, mobile..."
                    className="w-full min-h-[42px] pl-9 pr-3 rounded-xl border border-[#d6e0ee] text-xs sm:text-sm focus:outline-none focus:border-[#0b3d91]"
                  />
                </div>
                {data.memberCount < data.maxMembers && (
                  <button
                    type="button"
                    onClick={onAddMember}
                    className="min-h-[42px] px-4 rounded-xl bg-[#0f9f59] hover:bg-[#0c854a] text-white font-semibold text-xs sm:text-sm inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Member
                  </button>
                )}
              </div>
            </div>

            {!filteredMembers.length ? (
              <div className="py-12 text-center space-y-3">
                <div className="text-sm text-[#64748b]">
                  কোনো সদস্য পাওয়া যায়নি। নতুন সদস্য যোগ করতে "Add Member" বাটনে ক্লিক করুন।
                </div>
                {data.memberCount < data.maxMembers && (
                  <button
                    type="button"
                    onClick={onAddMember}
                    className="min-h-[42px] px-4 rounded-xl bg-[#0f9f59] hover:bg-[#0c854a] text-white font-semibold text-xs sm:text-sm inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    Add Shareholder Member
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-[#f8fafd] text-left text-[11px] font-semibold uppercase tracking-[0.04em] text-[#5b6b82] border-y border-[#e2e8f2]">
                      <th className="py-3 px-3.5">ID</th>
                      <th className="py-3 px-3.5">Name</th>
                      <th className="py-3 px-3.5">Mobile</th>
                      <th className="py-3 px-3.5 text-right">Net Deposit</th>
                      <th className="py-3 px-3.5">Status</th>
                      <th className="py-3 px-3.5">KYC</th>
                      <th className="py-3 px-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edf2f8]">
                    {filteredMembers.map((m) => (
                      <tr key={m.id} className="hover:bg-[#f9fbff] transition-colors">
                        <td className="py-3 px-3.5 font-mono-num font-semibold text-xs text-[#0b3d91]">
                          {m.id}
                        </td>
                        <td className="py-3 px-3.5 font-medium text-[#13294b] whitespace-nowrap">
                          {m.name}
                        </td>
                        <td className="py-3 px-3.5 font-mono-num text-xs text-[#475569] whitespace-nowrap">
                          {m.mobile || '—'}
                        </td>
                        <td className="py-3 px-3.5 font-mono-num font-semibold text-right text-[#0f9f59] whitespace-nowrap">
                          ৳ {money(m.total)}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap text-xs font-semibold">
                          <span
                            className={
                              m.status.toLowerCase() === 'inactive'
                                ? 'text-red-600'
                                : 'text-[#0f9f59]'
                            }
                          >
                            {m.status}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap text-xs font-semibold">
                          <span
                            className={
                              m.kycStatus === 'Completed' ? 'text-[#0f9f59]' : 'text-amber-700'
                            }
                          >
                            {m.kycStatus || 'Pending'}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onViewMemberKyc(m.id)}
                              className="min-h-[36px] px-2.5 rounded-lg bg-[#f1f5fb] hover:bg-[#e5edf9] text-[#0b3d91] text-xs font-semibold inline-flex items-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              KYC
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMemberStatement(m.id)}
                              className="min-h-[36px] px-2.5 rounded-lg bg-[#f1f5fb] hover:bg-[#e5edf9] text-[#0b3d91] text-xs font-semibold inline-flex items-center gap-1"
                            >
                              <FileDown className="w-3.5 h-3.5" />
                              PDF
                            </button>
                            <button
                              type="button"
                              onClick={() => onEditMember(m)}
                              className="min-h-[36px] px-2.5 rounded-lg bg-white border border-[#d6e0ee] hover:bg-slate-50 text-[#13294b] text-xs font-semibold inline-flex items-center gap-1"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              Edit
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* FDR & BANK LEDGER */}
        {tab === 'fdr' && (
          <div className="space-y-5">
            <section className="bg-white border border-[#dce4f0] rounded-2xl p-5 sm:p-6">
              <div className="mb-4">
                <h3 className="font-display text-base sm:text-lg font-bold text-[#0f2444]">
                  Institutional FDR Portfolio
                </h3>
                <p className="text-xs text-[#64748b] mt-0.5">
                  FDR placement reduces Main Bank; maturity settlement increases Main Bank
                </p>
              </div>
              {!data.fdrList.length ? (
                <div className="py-10 text-center text-sm text-[#64748b]">কোনো FDR নেই।</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-[#f8fafd] text-left text-[11px] font-semibold uppercase tracking-[0.04em] text-[#5b6b82] border-y border-[#e2e8f2]">
                        <th className="py-3 px-3.5">FDR ID</th>
                        <th className="py-3 px-3.5 text-right">Amount</th>
                        <th className="py-3 px-3.5">Date</th>
                        <th className="py-3 px-3.5">Maturity</th>
                        <th className="py-3 px-3.5">Bank</th>
                        <th className="py-3 px-3.5">FDR No</th>
                        <th className="py-3 px-3.5">Status</th>
                        <th className="py-3 px-3.5">Return</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#edf2f8]">
                      {data.fdrList.map((f) => (
                        <tr key={f.id} className="hover:bg-[#f9fbff] transition-colors">
                          <td className="py-3 px-3.5 font-mono-num font-semibold text-xs text-[#0b3d91]">
                            {f.id}
                          </td>
                          <td className="py-3 px-3.5 font-mono-num font-semibold text-right whitespace-nowrap">
                            ৳ {money(f.amount)}
                          </td>
                          <td className="py-3 px-3.5 font-mono-num text-xs text-[#475569] whitespace-nowrap">
                            {f.date}
                          </td>
                          <td className="py-3 px-3.5 font-mono-num text-xs text-[#475569] whitespace-nowrap">
                            {f.maturity}
                          </td>
                          <td className="py-3 px-3.5 whitespace-nowrap">{f.bank || '—'}</td>
                          <td className="py-3 px-3.5 font-mono-num text-xs">{f.no || '—'}</td>
                          <td className="py-3 px-3.5 whitespace-nowrap text-xs font-semibold">
                            <span
                              className={
                                f.status === 'Maturity Pending'
                                  ? 'text-amber-700'
                                  : f.status === 'Returned'
                                  ? 'text-[#64748b]'
                                  : 'text-[#0f9f59]'
                              }
                            >
                              {f.status}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 text-xs font-mono-num whitespace-nowrap">
                            {f.returnDate ? `${f.returnDate} / ৳ ${money(f.returned)}` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="bg-white border border-[#dce4f0] rounded-2xl p-5 sm:p-6">
              <h3 className="font-display text-base sm:text-lg font-bold text-[#0f2444] mb-4">
                Bank Account Entries
              </h3>
              {!data.bankEntries.length ? (
                <div className="py-10 text-center text-sm text-[#64748b]">
                  কোনো Bank Credit / Expense entry নেই।
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-[#f8fafd] text-left text-[11px] font-semibold uppercase tracking-[0.04em] text-[#5b6b82] border-y border-[#e2e8f2]">
                        <th className="py-3 px-3.5">Date</th>
                        <th className="py-3 px-3.5">Type</th>
                        <th className="py-3 px-3.5 text-right">Amount</th>
                        <th className="py-3 px-3.5">Reference</th>
                        <th className="py-3 px-3.5">Note</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#edf2f8]">
                      {data.bankEntries.map((b) => (
                        <tr key={b.id} className="hover:bg-[#f9fbff] transition-colors">
                          <td className="py-3 px-3.5 font-mono-num text-xs text-[#475569] whitespace-nowrap">
                            {b.date}
                          </td>
                          <td className="py-3 px-3.5 whitespace-nowrap font-medium">{b.type}</td>
                          <td className="py-3 px-3.5 font-mono-num font-semibold text-right whitespace-nowrap">
                            ৳ {money(b.amount)}
                          </td>
                          <td className="py-3 px-3.5 text-xs">{b.reference || '—'}</td>
                          <td className="py-3 px-3.5 text-xs text-[#64748b]">{b.note || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {/* KYC REQUESTS */}
        {tab === 'kyc' && (
          <section className="bg-white border border-[#dce4f0] rounded-2xl p-5 sm:p-6">
            <div className="mb-4">
              <h3 className="font-display text-base sm:text-lg font-bold text-[#0f2444]">
                KYC Update Requests
              </h3>
              <p className="text-xs text-[#64748b] mt-0.5">
                Member requests to unlock and update submitted KYC records
              </p>
            </div>
            {!data.kycRequests.length ? (
              <div className="py-10 text-center text-sm text-[#64748b]">
                কোনো KYC update request নেই।
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-[#f8fafd] text-left text-[11px] font-semibold uppercase tracking-[0.04em] text-[#5b6b82] border-y border-[#e2e8f2]">
                      <th className="py-3 px-3.5">Member</th>
                      <th className="py-3 px-3.5">Name</th>
                      <th className="py-3 px-3.5">Request</th>
                      <th className="py-3 px-3.5">Date</th>
                      <th className="py-3 px-3.5">Status</th>
                      <th className="py-3 px-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edf2f8]">
                    {data.kycRequests.map((r) => (
                      <tr key={r.id} className="hover:bg-[#f9fbff] transition-colors">
                        <td className="py-3 px-3.5 font-mono-num font-semibold text-xs text-[#0b3d91]">
                          {r.memberId}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap font-medium">{r.name}</td>
                        <td className="py-3 px-3.5 text-xs min-w-[200px]">{r.request}</td>
                        <td className="py-3 px-3.5 font-mono-num text-xs text-[#475569] whitespace-nowrap">
                          {r.requestDate}
                        </td>
                        <td className="py-3 px-3.5 text-xs font-semibold whitespace-nowrap">
                          <span
                            className={
                              r.status === 'Pending'
                                ? 'text-amber-700'
                                : r.status === 'Approved'
                                ? 'text-[#0f9f59]'
                                : 'text-red-600'
                            }
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 text-right whitespace-nowrap">
                          {r.status === 'Pending' ? (
                            <div className="inline-flex gap-1.5">
                              <button
                                type="button"
                                onClick={() => onReviewKyc(r, 'Approved')}
                                className="min-h-[36px] px-3 rounded-lg bg-[#0f9f59] hover:bg-[#0c854a] text-white text-xs font-semibold"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => onReviewKyc(r, 'Rejected')}
                                className="min-h-[36px] px-3 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-[#64748b]">
                              {r.adminNote || 'Processed'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* NOTICES & GOOGLE SHEETS SYNC */}
        {tab === 'notices' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Official Notice Board Manager */}
            <section className="lg:col-span-6 bg-white border border-[#dce4f0] rounded-2xl p-5 sm:p-6 space-y-5">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#edf2f8]">
                <div>
                  <h3 className="font-display text-base sm:text-lg font-bold text-[#0f2444] flex items-center gap-2">
                    <Megaphone className="w-4 h-4 text-[#0b3d91]" />
                    Official Notice Board
                  </h3>
                  <p className="text-xs text-[#64748b] mt-0.5">
                    Published notices appear immediately on the Main Page &amp; Member Portal
                  </p>
                </div>
              </div>

              <form onSubmit={handleCreateNotice} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className={fieldLabelCls}>Notice Title</label>
                    <input
                      type="text"
                      className={inputCls}
                      value={noticeTitle}
                      onChange={(e) => setNoticeTitle(e.target.value)}
                      placeholder="মাসিক জমা ও মিটিং সংক্রান্ত নোটিশ"
                    />
                  </div>
                  <div>
                    <label className={fieldLabelCls}>Priority</label>
                    <select
                      className={inputCls}
                      value={noticePriority}
                      onChange={(e) => setNoticePriority(e.target.value)}
                    >
                      <option value="Normal">Normal</option>
                      <option value="Important">Important</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className={fieldLabelCls}>Notice Details (বিবরণ)</label>
                  <textarea
                    rows={3}
                    className={`${inputCls} min-h-[84px]`}
                    value={noticeBody}
                    onChange={(e) => setNoticeBody(e.target.value)}
                    placeholder="সদস্যদের জন্য বিস্তারিত নোটিশ লিখুন..."
                  />
                </div>
                <button
                  type="submit"
                  disabled={noticeBusy}
                  className="min-h-[42px] px-5 rounded-xl bg-[#0b3d91] hover:bg-[#082e6e] text-white font-semibold text-sm inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  {noticeBusy ? 'Publishing...' : 'Publish Notice'}
                </button>
              </form>

              <div className="border-t border-[#edf2f8] pt-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#5b6b82] mb-2">
                  Active Published Notices ({data.notices?.length || 0})
                </h4>
                {!data.notices?.length ? (
                  <div className="py-6 text-center text-xs sm:text-sm text-[#64748b]">
                    এখনও কোনো নোটিশ প্রকাশ করা হয়নি।
                  </div>
                ) : (
                  <ul className="divide-y divide-[#edf2f8]">
                    {data.notices.map((n) => (
                      <li key={n.id} className="py-3 flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {n.priority === 'Urgent' ? (
                              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                            ) : n.priority === 'Important' ? (
                              <BellRing className="w-4 h-4 text-amber-700 shrink-0" />
                            ) : (
                              <Megaphone className="w-3.5 h-3.5 text-[#0b3d91] shrink-0" />
                            )}
                            <span className="font-bold text-sm text-[#0f2444] truncate">
                              {n.title}
                            </span>
                          </div>
                          <p className="text-xs text-[#475569] mt-1 whitespace-pre-line">{n.body}</p>
                          <div className="text-[11px] font-mono-num text-[#64748b] mt-1">
                            {n.priority} · {n.createdAt}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteNotice(n.id)}
                          aria-label={`Delete notice ${n.title}`}
                          className="min-h-[36px] min-w-[36px] px-2.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 inline-flex items-center justify-center shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            {/* Google Sheets Live Data Store (Billing-Free Apps Script Webhook) */}
            <section className="lg:col-span-6 bg-white border border-[#dce4f0] rounded-2xl p-5 sm:p-6 space-y-5">
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#edf2f8]">
                <div>
                  <h3 className="font-display text-base sm:text-lg font-bold text-[#0f2444] flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-[#0f9f59]" />
                    Google Sheets Data Storage (Billing-Free)
                  </h3>
                  <p className="text-xs text-[#64748b] mt-0.5">
                    সকল ইনপুটকৃত ডেটা (Members, Transactions, FDR, Bank, KYC, Notices) সরাসরি আপনার Google Sheet-এ সেভ করুন
                  </p>
                </div>
              </div>

              {/* Connected Sheet Status OR Setup Guide */}
              {hasConnectedSheet ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-[#eefbf3] border border-[#bbf7d0] space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#166534]">
                        Google Sheet Connected (Auto-Sync Active)
                      </span>
                      {sheetCfg?.sheetUrl && (
                        <a
                          href={sheetCfg.sheetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-bold text-[#0b3d91] hover:underline"
                        >
                          Open Google Sheet
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                    <div className="text-xs font-mono-num text-[#13294b] break-all">
                      Web App: {sheetCfg?.webhookUrl}
                    </div>
                    <div className="text-[11px] font-mono-num text-[#475569]">
                      Last Synced: {sheetCfg?.lastSync || 'Never'}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2.5">
                    <button
                      type="button"
                      disabled={sheetBusy}
                      onClick={() => setConfirmModal({ kind: 'sync' })}
                      className="min-h-[42px] px-4 rounded-xl bg-[#0f9f59] hover:bg-[#0c854a] disabled:opacity-50 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Sync All Data Now
                    </button>
                    <button
                      type="button"
                      disabled={sheetBusy}
                      onClick={() => setConfirmModal({ kind: 'disconnect' })}
                      className="min-h-[42px] px-4 rounded-xl bg-white border border-[#d6e0ee] hover:bg-slate-50 text-[#dc2626] text-xs sm:text-sm font-semibold inline-flex items-center gap-2"
                    >
                      <Unlink className="w-4 h-4" />
                      Disconnect Sheet
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Step 1: Copy Apps Script */}
                  <div className="p-4 rounded-xl bg-[#f8fafd] border border-[#e2e8f2] space-y-2.5">
                    <div className="text-xs font-bold text-[#0f2444]">
                      ধাপ ১: আপনার Google Sheet-এ Apps Script বসান (১০০% ফ্রি)
                    </div>
                    <ol className="list-decimal list-inside text-xs text-[#475569] space-y-1 leading-relaxed">
                      <li>যেকোনো একটি নতুন বা পুরোনো Google Sheet খুলুন।</li>
                      <li>
                        উপরের মেনু থেকে{' '}
                        <span className="font-semibold text-[#0f2444]">
                          Extensions → Apps Script
                        </span>{' '}
                        খুলুন।
                      </li>
                      <li>আগের কোড মুছে নিচের কোডটি পেস্ট করে Save করুন।</li>
                      <li>
                        <span className="font-semibold text-[#0f2444]">
                          Deploy → New deployment → Web app
                        </span>{' '}
                        সিলেক্ট করে <span className="font-semibold">Who has access: Anyone</span>{' '}
                        দিয়ে Deploy করুন এবং Web App URL কপি করুন।
                      </li>
                    </ol>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleCopyScript}
                        className="min-h-[38px] px-3.5 rounded-lg bg-[#0b3d91] hover:bg-[#082e6e] text-white text-xs font-semibold inline-flex items-center gap-1.5"
                      >
                        {copiedScript ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        {copiedScript ? 'Copied!' : 'Copy Apps Script Code'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowScriptCode((v) => !v)}
                        className="min-h-[38px] px-3.5 rounded-lg bg-white border border-[#d6e0ee] hover:bg-slate-50 text-[#13294b] text-xs font-semibold inline-flex items-center gap-1.5"
                      >
                        <Code2 className="w-3.5 h-3.5" />
                        {showScriptCode ? 'Hide Code' : 'View Code'}
                      </button>
                    </div>
                    {showScriptCode && (
                      <textarea
                        readOnly
                        rows={8}
                        value={APPS_SCRIPT_CODE}
                        className="w-full p-3 rounded-lg border border-[#d6e0ee] bg-white font-mono text-[11px] text-[#0f2444] focus:outline-none"
                      />
                    )}
                  </div>

                  {/* Step 2: Paste Web App URL & Connect */}
                  <div className="space-y-2">
                    <label className={fieldLabelCls}>
                      ধাপ ২: Google Apps Script Web App URL পেস্ট করুন
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="url"
                        className={inputCls}
                        value={webhookInput}
                        onChange={(e) => setWebhookInput(e.target.value)}
                        placeholder="https://script.google.com/macros/s/.../exec"
                      />
                      <button
                        type="button"
                        disabled={!webhookInput.trim() || sheetBusy}
                        onClick={() =>
                          setConfirmModal({
                            kind: 'connect',
                            webhookUrl: webhookInput.trim(),
                          })
                        }
                        className="min-h-[42px] px-4 rounded-xl bg-[#0f9f59] hover:bg-[#0c854a] disabled:opacity-50 text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
                      >
                        <Link2 className="w-4 h-4" />
                        Connect &amp; Sync
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="text-xs text-[#64748b] pt-2 border-t border-[#edf2f8] leading-relaxed">
                কানেক্ট করার পর থেকে নতুন Member, Deposit/Withdrawal, FDR, Bank Entry, KYC বা Notice যোগ করলেই স্বয়ংক্রিয়ভাবে Google Sheet-এর ৮টি ট্যাবে (
                <span className="font-mono-num">
                  Summary, Members, Transactions, FDR, BankEntries, KYC, KYCRequests, Notices
                </span>
                ) ডেটা সেভ হয়ে যাবে।
              </div>
            </section>
          </div>
        )}
      </main>

      {/* Google Sheets Confirmation Modal */}
      {confirmModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
          onClick={() => !sheetBusy && setConfirmModal(null)}
        >
          <div
            className="w-full max-w-md bg-white border border-[#dce4f0] rounded-2xl p-6 shadow-xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#eefbf3] text-[#0f9f59] flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <h4 className="font-display text-base font-bold text-[#0f2444]">
                  {confirmModal.kind === 'connect'
                    ? 'Connect & Sync Google Sheet?'
                    : confirmModal.kind === 'sync'
                    ? 'Sync All Data to Google Sheets?'
                    : 'Disconnect Google Sheet?'}
                </h4>
              </div>
              <button
                type="button"
                disabled={sheetBusy}
                onClick={() => setConfirmModal(null)}
                className="p-1.5 rounded-lg text-[#64748b] hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs sm:text-sm text-[#475569] leading-relaxed">
              {confirmModal.kind === 'connect' && (
                <>
                  এটি আপনার Google Apps Script Web App-এর মাধ্যমে ৮টি ট্যাবে ({data.memberCount}{' '}
                  জন সদস্য, {data.recent.length}টি লেনদেন, {data.fdrList.length}টি FDR,{' '}
                  {data.notices?.length || 0}টি নোটিশ) সকল ডেটা আপডেট করবে।
                </>
              )}
              {confirmModal.kind === 'sync' && (
                <>
                  বর্তমান ডাটাবেজের সকল তথ্য (Summary, Members, Transactions, FDR, BankEntries, KYC,
                  KYCRequests, Notices) আপনার কানেক্টেড Google Sheet-এ আপডেট করা হবে।
                </>
              )}
              {confirmModal.kind === 'disconnect' && (
                <>
                  অ্যাপ থেকে Google Sheet সিঙ্ক সংযোগ বিচ্ছিন্ন করা হবে (আপনার Google Sheet ফাইলটি
                  মুছবে না)।
                </>
              )}
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={sheetBusy}
                onClick={() => setConfirmModal(null)}
                className="min-h-[40px] px-4 rounded-xl bg-white border border-[#d6e0ee] text-xs sm:text-sm font-semibold text-[#13294b]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={sheetBusy}
                onClick={executeConfirmedSheetAction}
                className={`min-h-[40px] px-4 rounded-xl text-white text-xs sm:text-sm font-semibold ${
                  confirmModal.kind === 'disconnect'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-[#0f9f59] hover:bg-[#0c854a]'
                }`}
              >
                {sheetBusy ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#e2e8f2] pb-safe no-print">
        <div className="grid grid-cols-5 h-16 items-center">
          {(
            [
              ['overview', 'Entry', LayoutDashboard],
              ['members', 'Members', Users],
              ['fdr', 'FDR', Landmark],
              ['kyc', pendingReqCount ? `KYC (${pendingReqCount})` : 'KYC', FileCheck2],
              ['notices', 'Notice/Sheet', FileSpreadsheet],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`flex flex-col items-center justify-center min-h-[44px] ${
                tab === key ? 'text-[#0b3d91]' : 'text-[#64748b]'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-semibold mt-1 truncate max-w-[68px]">{label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
