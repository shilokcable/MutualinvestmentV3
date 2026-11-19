import { useMemo, useState } from 'react';
import {
  User,
  FileDown,
  Camera,
  Mail,
  Printer,
  LogOut,
  Search,
  Landmark,
  ReceiptText,
  Home,
  CheckCircle2,
  Clock,
  Wallet,
  TrendingUp,
  Building2,
  Layers,
  CalendarClock,
  Megaphone,
  AlertTriangle,
  BellRing,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';
import type { MemberDashboardData } from '../types';
import { money } from '../utils/format';
import { api } from '../api';
import { generateKycPdf, generateStatementPdf } from '../utils/pdfGenerator';
import { PWAInstallButton } from './PWAInstallButton';
import { SavingsGrowthChart } from './SavingsGrowthChart';

interface MemberDashboardProps {
  data: MemberDashboardData;
  token: string;
  onOpenProfile: () => void;
  onOpenKyc: () => void;
  onOpenPhotoModal: () => void;
  onOpenRequestModal: () => void;
  onOpenAndroidGuide: () => void;
  onLogout: () => void;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

export function MemberDashboard({
  data,
  token,
  onOpenProfile,
  onOpenKyc,
  onOpenPhotoModal,
  onOpenRequestModal,
  onOpenAndroidGuide,
  onLogout,
  onNotify,
}: MemberDashboardProps) {
  const [mobileTab, setMobileTab] = useState<'overview' | 'ledger'>('overview');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [busyPdf, setBusyPdf] = useState(false);

  const kycCompleted = Boolean(data.kyc?.completed);
  const photo = data.kyc?.photoData || data.kyc?.memberPhoto || '';
  const reqStatus = data.kyc?.requestStatus || '';
  const notices = data.notices || [];

  const { totalDeposits, totalWithdrawals } = useMemo(() => {
    let dep = 0;
    let wd = 0;
    for (const tx of data.transactions) {
      if (tx.type === 'Withdrawal') wd += Number(tx.amount || 0);
      else dep += Number(tx.amount || 0);
    }
    return { totalDeposits: dep, totalWithdrawals: wd };
  }, [data.transactions]);

  const filteredTx = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.transactions.filter((tx) => {
      if (typeFilter !== 'All' && tx.type !== typeFilter) return false;
      if (!q) return true;
      return (
        tx.date.toLowerCase().includes(q) ||
        tx.type.toLowerCase().includes(q) ||
        (tx.note || '').toLowerCase().includes(q)
      );
    });
  }, [data.transactions, search, typeFilter]);

  const handleDownloadKycPdf = async () => {
    if (!data.kyc || !data.kyc.completed) {
      onNotify('KYC PDF পাওয়া যায়নি। আগে KYC সম্পন্ন করুন।', 'error');
      return;
    }
    setBusyPdf(true);
    try {
      await generateKycPdf(data.kyc);
      onNotify('KYC PDF downloaded');
    } catch (e) {
      onNotify(e instanceof Error ? e.message : 'PDF generation error', 'error');
    } finally {
      setBusyPdf(false);
    }
  };

  const handleDownloadStatement = async () => {
    setBusyPdf(true);
    try {
      const stmt = await api.getStatement(token);
      await generateStatementPdf(stmt);
      onNotify('Single-page A4 Statement PDF downloaded');
    } catch (e) {
      onNotify(e instanceof Error ? e.message : 'Statement download error', 'error');
    } finally {
      setBusyPdf(false);
    }
  };

  return (
    <div className="min-h-screen pb-24 md:pb-12 bg-[#f6f8fc]">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#e2e8f2] no-print">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/logo.jpg"
              alt="MUTUAL INVESTMENT-2026"
              className="h-9 w-auto object-contain shrink-0"
            />
            <span className="hidden sm:inline text-xs text-[#64748b] truncate">
              Shareholder Portal ·{' '}
              <span className="font-mono-num font-semibold text-[#0b3d91]">{data.memberId}</span>
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
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Executive Shareholder Summary */}
        <section
          className={`bg-white border border-[#dce4f0] rounded-2xl p-5 sm:p-7 shadow-[0_1px_3px_rgba(11,61,145,0.04)] ${
            mobileTab === 'ledger' ? 'hidden md:block' : ''
          }`}
        >
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-center gap-4 sm:gap-5 min-w-0">
              {photo ? (
                <img
                  src={photo}
                  alt={data.name}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border border-[#dce4f0] bg-[#f1f5fb] shrink-0"
                />
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border border-[#dce4f0] bg-[#eef4ff] flex items-center justify-center text-[#0b3d91] shrink-0">
                  <User className="w-8 h-8" />
                </div>
              )}

              <div className="min-w-0">
                <div className="text-xs font-medium text-[#64748b] flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#0b3d91]" />
                  Verified Shareholder Account
                </div>
                <h1 className="font-display text-xl sm:text-2xl font-extrabold text-[#0f2444] truncate mt-0.5">
                  {data.name}
                </h1>
                <div className="text-xs text-[#64748b] mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <span className="font-mono-num font-semibold text-[#0b3d91]">{data.memberId}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-num">{data.mobile || 'No mobile'}</span>
                  <span aria-hidden="true">·</span>
                  <span
                    className={`font-semibold ${
                      data.accountStatus === 'Inactive' ? 'text-red-600' : 'text-[#0f9f59]'
                    }`}
                  >
                    {data.accountStatus}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span
                    className={`inline-flex items-center gap-1 font-semibold ${
                      kycCompleted ? 'text-[#0f9f59]' : 'text-amber-700'
                    }`}
                  >
                    {kycCompleted ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" /> KYC Verified
                      </>
                    ) : (
                      <>
                        <Clock className="w-3.5 h-3.5" /> KYC Pending
                      </>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Balance & Deposit Breakdown */}
            <div className="lg:text-right border-t lg:border-t-0 lg:border-l border-[#edf2f8] pt-4 lg:pt-0 lg:pl-8">
              <div className="text-xs font-medium text-[#64748b] inline-flex items-center gap-1.5 lg:justify-end">
                <Wallet className="w-3.5 h-3.5 text-[#0f9f59]" />
                আপনার বর্তমান নেট জমা (Net Capital)
              </div>
              <div className="font-mono-num text-3xl sm:text-4xl font-bold text-[#0f9f59] tracking-tight mt-1">
                ৳ {money(data.total)}
              </div>
              <div className="text-xs text-[#64748b] mt-1.5 font-mono-num flex flex-wrap lg:justify-end gap-x-3 gap-y-1">
                <span>Deposits: +৳ {money(totalDeposits)}</span>
                <span aria-hidden="true">·</span>
                <span>Withdrawals: −৳ {money(totalWithdrawals)}</span>
              </div>
            </div>
          </div>

          {reqStatus && (
            <div className="mt-5 px-4 py-3 rounded-xl bg-[#f6f9ff] border border-[#dce4f0] text-xs text-[#13294b]">
              Update Request Status: <span className="font-semibold">{reqStatus}</span>
              {data.kyc?.requestNote ? ` · Note: ${data.kyc.requestNote}` : ''}
            </div>
          )}

          {/* Action Toolbar */}
          <div className="mt-6 pt-5 border-t border-[#edf2f8] flex flex-wrap items-center gap-2.5 no-print">
            <button
              type="button"
              disabled={busyPdf}
              onClick={handleDownloadStatement}
              className="min-h-[42px] px-4 rounded-xl bg-[#0b3d91] hover:bg-[#082e6e] text-white font-semibold text-xs sm:text-sm inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
            >
              <FileDown className="w-4 h-4 shrink-0" />
              A4 Statement PDF
            </button>

            {!kycCompleted ? (
              <button
                type="button"
                onClick={onOpenKyc}
                className="min-h-[42px] px-4 rounded-xl bg-[#0f9f59] hover:bg-[#0c854a] text-white font-semibold text-xs sm:text-sm inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
              >
                <ShieldCheck className="w-4 h-4 shrink-0" />
                Complete KYC (6 Steps)
              </button>
            ) : (
              <button
                type="button"
                disabled={busyPdf}
                onClick={handleDownloadKycPdf}
                className="min-h-[42px] px-4 rounded-xl bg-[#0f9f59] hover:bg-[#0c854a] text-white font-semibold text-xs sm:text-sm inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
              >
                <FileDown className="w-4 h-4 shrink-0" />
                Download KYC PDF
              </button>
            )}

            <button
              type="button"
              onClick={onOpenProfile}
              className="min-h-[42px] px-4 rounded-xl bg-white hover:bg-[#f6f9ff] text-[#13294b] border border-[#d6e0ee] font-semibold text-xs sm:text-sm inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
            >
              <User className="w-4 h-4 shrink-0 text-[#0b3d91]" />
              My Profile
            </button>

            {kycCompleted && (
              <>
                <button
                  type="button"
                  onClick={onOpenPhotoModal}
                  className="min-h-[42px] px-4 rounded-xl bg-white hover:bg-[#f6f9ff] text-[#13294b] border border-[#d6e0ee] font-semibold text-xs sm:text-sm inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
                >
                  <Camera className="w-4 h-4 shrink-0 text-[#0b3d91]" />
                  Change Photo
                </button>
                <button
                  type="button"
                  onClick={onOpenRequestModal}
                  className="min-h-[42px] px-4 rounded-xl bg-white hover:bg-[#f6f9ff] text-[#13294b] border border-[#d6e0ee] font-semibold text-xs sm:text-sm inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
                >
                  <Mail className="w-4 h-4 shrink-0 text-[#0b3d91]" />
                  Request Update
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => window.print()}
              className="min-h-[42px] px-3.5 rounded-xl bg-white hover:bg-[#f6f9ff] text-[#475569] border border-[#d6e0ee] font-semibold text-xs sm:text-sm inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
            >
              <Printer className="w-4 h-4 shrink-0" />
              Print
            </button>
          </div>
        </section>

        {/* Notice Board (Visible to Member) */}
        {notices.length > 0 && (
          <section
            className={`bg-white border border-[#dce4f0] rounded-2xl p-5 sm:p-6 ${
              mobileTab === 'ledger' ? 'hidden md:block' : ''
            }`}
          >
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#edf2f8]">
              <h2 className="font-display text-base font-bold text-[#0f2444] flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-[#0b3d91]" />
                অফিশিয়াল নোটিশ বোর্ড (Cooperative Notices)
              </h2>
              <span className="text-xs font-mono-num text-[#64748b]">{notices.length}</span>
            </div>
            <ul className="divide-y divide-[#edf2f8] mt-1">
              {notices.map((n) => {
                const isUrgent = n.priority === 'Urgent';
                const isImportant = n.priority === 'Important';
                return (
                  <li key={n.id} className="py-3 flex items-start gap-3">
                    <div
                      className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        isUrgent
                          ? 'bg-red-50 text-red-600'
                          : isImportant
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-[#eef4ff] text-[#0b3d91]'
                      }`}
                    >
                      {isUrgent ? (
                        <AlertTriangle className="w-4 h-4" />
                      ) : isImportant ? (
                        <BellRing className="w-4 h-4" />
                      ) : (
                        <Megaphone className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h3 className="text-sm font-bold text-[#0f2444]">{n.title}</h3>
                        <span className="text-[11px] font-mono-num text-[#64748b]">
                          {n.priority} · {n.createdAt}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-[#475569] mt-1 whitespace-pre-line">
                        {n.body}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Institutional Financial Status (Categorized with Symbols) */}
        <section className={mobileTab === 'ledger' ? 'hidden md:block' : ''}>
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
            <div>
              <h2 className="font-display text-base sm:text-lg font-bold text-[#0f2444] flex items-center gap-2">
                <Landmark className="w-4 h-4 text-[#0b3d91]" />
                প্রতিষ্ঠানের বর্তমান আর্থিক অবস্থা
              </h2>
              <p className="text-xs text-[#64748b] mt-0.5">
                Institutional overview · শুধু দেখার জন্য (ব্যক্তিগত জমার অংশ নয়)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
            <div className="bg-white border border-[#dce4f0] rounded-2xl p-4 col-span-2 lg:col-span-1 flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-medium text-[#64748b]">Main Bank Balance</div>
                <div className="font-mono-num text-xl font-bold text-[#0b3d91] mt-1.5">
                  ৳ {money(data.mainBank)}
                </div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-[#eef4ff] text-[#0b3d91] flex items-center justify-center shrink-0">
                <Landmark className="w-4 h-4" />
              </div>
            </div>

            <div className="bg-white border border-[#dce4f0] rounded-2xl p-4 flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-medium text-[#64748b]">FDR Balance</div>
                <div className="font-mono-num text-xl font-bold text-[#b45309] mt-1.5">
                  ৳ {money(data.fdrBalance)}
                </div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-[#b45309] flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>

            <div className="bg-white border border-[#dce4f0] rounded-2xl p-4 flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-medium text-[#64748b]">Total Institutional</div>
                <div className="font-mono-num text-xl font-bold text-[#0f9f59] mt-1.5">
                  ৳ {money(data.totalInstitutional)}
                </div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-[#eefbf3] text-[#0f9f59] flex items-center justify-center shrink-0">
                <Building2 className="w-4 h-4" />
              </div>
            </div>

            <div className="bg-white border border-[#dce4f0] rounded-2xl p-4 flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-medium text-[#64748b]">Active FDR</div>
                <div className="font-mono-num text-xl font-bold text-[#0f2444] mt-1.5">
                  {data.activeFdr}
                </div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-[#f1f5fb] text-[#0b3d91] flex items-center justify-center shrink-0">
                <Layers className="w-4 h-4" />
              </div>
            </div>

            <div className="bg-white border border-[#dce4f0] rounded-2xl p-4 flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-medium text-[#64748b]">Maturity Pending</div>
                <div className="font-mono-num text-xl font-bold text-[#b45309] mt-1.5">
                  {data.pendingFdr}
                </div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-[#b45309] flex items-center justify-center shrink-0">
                <CalendarClock className="w-4 h-4" />
              </div>
            </div>
          </div>
        </section>

        {/* Monthly Savings Balance Growth Line Chart */}
        <div className={mobileTab === 'ledger' ? 'hidden md:block' : ''}>
          <SavingsGrowthChart transactions={data.transactions} currentBalance={data.total} />
        </div>

        {/* Transactions Ledger */}
        <section className="bg-white border border-[#dce4f0] rounded-2xl p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <h2 className="font-display text-base sm:text-lg font-bold text-[#0f2444] flex items-center gap-2">
                <ReceiptText className="w-4 h-4 text-[#0b3d91]" />
                আপনার লেনদেন (Personal Ledger)
              </h2>
              <p className="text-xs text-[#64748b] mt-0.5">
                Private statement · Only your personal account is visible
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 no-print">
              <div className="relative flex-1 sm:w-56">
                <Search className="w-4 h-4 text-[#64748b] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search date or note..."
                  className="w-full min-h-[40px] pl-9 pr-3 rounded-xl border border-[#d6e0ee] text-xs sm:text-sm focus:outline-none focus:border-[#0b3d91]"
                />
              </div>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="min-h-[40px] px-3 rounded-xl border border-[#d6e0ee] text-xs sm:text-sm bg-white focus:outline-none focus:border-[#0b3d91]"
              >
                <option value="All">All Types</option>
                <option value="Monthly Deposit">Monthly Deposit</option>
                <option value="Special Deposit">Special Deposit</option>
                <option value="Withdrawal">Withdrawal</option>
              </select>
            </div>
          </div>

          {!filteredTx.length ? (
            <div className="py-12 text-center text-sm text-[#64748b]">
              এখনও কোনো লেনদেন পাওয়া যায়নি।
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-[#f8fafd] text-left text-[11px] font-semibold uppercase tracking-[0.04em] text-[#5b6b82] border-y border-[#e2e8f2]">
                    <th className="py-3 px-3.5 whitespace-nowrap">Date</th>
                    <th className="py-3 px-3.5 whitespace-nowrap">Category &amp; Type</th>
                    <th className="py-3 px-3.5 whitespace-nowrap text-right">Amount</th>
                    <th className="py-3 px-3.5">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf2f8]">
                  {filteredTx.map((tx, idx) => {
                    const isWd = tx.type === 'Withdrawal';
                    return (
                      <tr key={tx.id || idx} className="hover:bg-[#f9fbff] transition-colors">
                        <td className="py-3 px-3.5 font-mono-num text-xs text-[#475569] whitespace-nowrap">
                          {tx.date}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap font-medium text-[#13294b]">
                          <span className="inline-flex items-center gap-2">
                            <span
                              className={`w-6 h-6 rounded-md inline-flex items-center justify-center shrink-0 ${
                                isWd ? 'bg-red-50 text-red-600' : 'bg-[#eefbf3] text-[#0f9f59]'
                              }`}
                            >
                              {isWd ? (
                                <ArrowUpRight className="w-3.5 h-3.5" />
                              ) : (
                                <ArrowDownLeft className="w-3.5 h-3.5" />
                              )}
                            </span>
                            {tx.type}
                          </span>
                        </td>
                        <td
                          className={`py-3 px-3.5 font-mono-num font-semibold text-right whitespace-nowrap ${
                            isWd ? 'text-red-600' : 'text-[#0f9f59]'
                          }`}
                        >
                          {isWd ? '−' : '+'}৳ {money(tx.amount)}
                        </td>
                        <td className="py-3 px-3.5 text-xs text-[#64748b]">{tx.note || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {/* Mobile Bottom Tab Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#e2e8f2] pb-safe no-print">
        <div className="grid grid-cols-4 h-16 items-center">
          <button
            type="button"
            onClick={() => setMobileTab('overview')}
            className={`flex flex-col items-center justify-center min-h-[44px] ${
              mobileTab === 'overview' ? 'text-[#0b3d91]' : 'text-[#64748b]'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[11px] font-semibold mt-1">Home</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('ledger')}
            className={`flex flex-col items-center justify-center min-h-[44px] ${
              mobileTab === 'ledger' ? 'text-[#0b3d91]' : 'text-[#64748b]'
            }`}
          >
            <ReceiptText className="w-5 h-5" />
            <span className="text-[11px] font-semibold mt-1">Ledger</span>
          </button>
          <button
            type="button"
            onClick={onOpenProfile}
            className="flex flex-col items-center justify-center min-h-[44px] text-[#64748b] active:text-[#0b3d91]"
          >
            <User className="w-5 h-5" />
            <span className="text-[11px] font-semibold mt-1">Profile</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadStatement}
            className="flex flex-col items-center justify-center min-h-[44px] text-[#64748b] active:text-[#0b3d91]"
          >
            <FileDown className="w-5 h-5" />
            <span className="text-[11px] font-semibold mt-1">Statement</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
