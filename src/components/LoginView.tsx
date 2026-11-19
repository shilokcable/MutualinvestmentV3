import { useEffect, useState } from 'react';
import {
  Shield,
  UserCheck,
  Lock,
  ArrowRight,
  Megaphone,
  AlertTriangle,
  BellRing,
} from 'lucide-react';
import { api } from '../api';
import type { NoticeItem, UserRole } from '../types';

interface LoginViewProps {
  onLoginSuccess: (token: string, role: UserRole) => void;
  onOpenAndroidGuide?: () => void;
}

export function LoginView({ onLoginSuccess }: LoginViewProps) {
  const [tab, setTab] = useState<UserRole>('member');
  const [memberId, setMemberId] = useState('');
  const [password, setPassword] = useState('');
  const [adminPin, setAdminPin] = useState('');
  const [msg, setMsg] = useState('');
  const [isErr, setIsErr] = useState(false);
  const [loading, setLoading] = useState(false);

  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [loadingNotices, setLoadingNotices] = useState(true);

  useEffect(() => {
    let active = true;
    api
      .getNotices()
      .then((res) => {
        if (active && res.ok) setNotices(res.notices || []);
      })
      .finally(() => {
        if (active) setLoadingNotices(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleMemberLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberId.trim() || !password.trim()) {
      setIsErr(true);
      setMsg('Member ID এবং Password দিন।');
      return;
    }
    setLoading(true);
    setIsErr(false);
    setMsg('Login হচ্ছে...');
    try {
      const res = await api.memberLogin(memberId.trim(), password.trim());
      if (!res.ok || !res.token) {
        setIsErr(true);
        setMsg(res.message || 'Login failed.');
        return;
      }
      onLoginSuccess(res.token, 'member');
    } catch (err) {
      setIsErr(true);
      setMsg('Login Error: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPin.trim()) {
      setIsErr(true);
      setMsg('Admin PIN দিন।');
      return;
    }
    setLoading(true);
    setIsErr(false);
    setMsg('Admin login হচ্ছে...');
    try {
      const res = await api.adminLogin(adminPin.trim());
      if (!res.ok || !res.token) {
        setIsErr(true);
        setMsg(res.message || 'Invalid PIN.');
        return;
      }
      onLoginSuccess(res.token, 'admin');
    } catch (err) {
      setIsErr(true);
      setMsg('Login Error: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f6f8fc]">
      {/* Logo Only Header */}
      <header className="w-full border-b border-[#e2e8f2] bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-center sm:justify-start">
          <img
            src="/logo.jpg"
            alt="MUTUAL INVESTMENT-2026"
            className="h-10 w-auto object-contain"
          />
        </div>
      </header>

      {/* Main Content: Strictly Notice Board + Login Portal */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-8 lg:py-12">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* Login Portal */}
          <section className="lg:col-span-5 order-1">
            <div className="w-full bg-white border border-[#dce4f0] rounded-2xl p-6 sm:p-7 shadow-[0_2px_10px_rgba(11,61,145,0.05)]">
              <div className="mb-5">
                <h1 className="font-display text-2xl font-extrabold text-[#0f2444]">
                  Login Portal
                </h1>
              </div>

              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#f1f5fb] border border-[#e2e8f2] mb-5">
                <button
                  type="button"
                  onClick={() => {
                    setTab('member');
                    setMsg('');
                  }}
                  className={`min-h-[44px] rounded-lg text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${
                    tab === 'member'
                      ? 'bg-[#0b3d91] text-white shadow-xs'
                      : 'text-[#334155] hover:text-[#0b3d91]'
                  }`}
                >
                  <UserCheck className="w-4 h-4 shrink-0" />
                  Member
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTab('admin');
                    setMsg('');
                  }}
                  className={`min-h-[44px] rounded-lg text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${
                    tab === 'admin'
                      ? 'bg-[#0b3d91] text-white shadow-xs'
                      : 'text-[#334155] hover:text-[#0b3d91]'
                  }`}
                >
                  <Shield className="w-4 h-4 shrink-0" />
                  Admin
                </button>
              </div>

              {tab === 'member' ? (
                <form onSubmit={handleMemberLogin} className="space-y-4">
                  <div>
                    <label
                      htmlFor="memberId"
                      className="block text-xs font-semibold text-[#1e3a5f] mb-1.5"
                    >
                      Member ID
                    </label>
                    <input
                      id="memberId"
                      type="text"
                      autoComplete="username"
                      value={memberId}
                      onChange={(e) => setMemberId(e.target.value)}
                      placeholder="Enter Member ID"
                      className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border border-[#d6e0ee] bg-white text-sm text-[#13294b] font-mono-num uppercase focus:outline-none focus:ring-2 focus:ring-[#0b3d91]/20 focus:border-[#0b3d91]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="memberPass"
                      className="block text-xs font-semibold text-[#1e3a5f] mb-1.5"
                    >
                      Password
                    </label>
                    <input
                      id="memberPass"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border border-[#d6e0ee] bg-white text-sm text-[#13294b] focus:outline-none focus:ring-2 focus:ring-[#0b3d91]/20 focus:border-[#0b3d91]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full min-h-[48px] rounded-xl bg-[#0b3d91] hover:bg-[#082e6e] disabled:opacity-60 text-white font-semibold text-sm inline-flex items-center justify-center gap-2 transition-colors"
                  >
                    {loading ? 'Signing in...' : 'Sign In'}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              ) : (
                <form onSubmit={handleAdminLogin} className="space-y-4">
                  <div>
                    <label
                      htmlFor="adminPin"
                      className="block text-xs font-semibold text-[#1e3a5f] mb-1.5"
                    >
                      Admin PIN
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-[#64748b] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        id="adminPin"
                        type="password"
                        value={adminPin}
                        onChange={(e) => setAdminPin(e.target.value)}
                        placeholder="Enter Admin PIN"
                        className="w-full min-h-[46px] pl-10 pr-3.5 py-2.5 rounded-xl border border-[#d6e0ee] bg-white text-sm text-[#13294b] focus:outline-none focus:ring-2 focus:ring-[#0b3d91]/20 focus:border-[#0b3d91]"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full min-h-[48px] rounded-xl bg-[#0b3d91] hover:bg-[#082e6e] disabled:opacity-60 text-white font-semibold text-sm inline-flex items-center justify-center gap-2 transition-colors"
                  >
                    {loading ? 'Verifying...' : 'Admin Sign In'}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              )}

              {msg && (
                <div
                  className={`mt-3 text-xs sm:text-sm font-semibold ${
                    isErr ? 'text-red-600' : 'text-[#0b3d91]'
                  }`}
                >
                  {msg}
                </div>
              )}
            </div>
          </section>

          {/* Official Notice Board */}
          <section className="lg:col-span-7 order-2">
            <div className="bg-white border border-[#dce4f0] rounded-2xl p-6 sm:p-7 shadow-[0_2px_10px_rgba(11,61,145,0.05)]">
              <div className="flex items-center justify-between gap-3 pb-3.5 border-b border-[#edf2f8]">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#eef4ff] text-[#0b3d91] flex items-center justify-center shrink-0">
                    <Megaphone className="w-4 h-4" />
                  </div>
                  <h2 className="font-display text-lg font-bold text-[#0f2444]">
                    Notice Board (নোটিশ বোর্ড)
                  </h2>
                </div>
                <span className="text-xs font-mono-num text-[#64748b] shrink-0">
                  {notices.length} Notice{notices.length === 1 ? '' : 's'}
                </span>
              </div>

              {loadingNotices ? (
                <div className="py-8 text-xs sm:text-sm text-[#64748b]">Loading notices...</div>
              ) : !notices.length ? (
                <div className="py-10 text-center text-sm text-[#64748b]">
                  বর্তমানে কোনো নোটিশ নেই।
                </div>
              ) : (
                <ul className="divide-y divide-[#edf2f8] mt-1">
                  {notices.map((n) => {
                    const isUrgent = n.priority === 'Urgent';
                    const isImportant = n.priority === 'Important';
                    return (
                      <li key={n.id} className="py-3.5 first:pt-3 last:pb-1">
                        <div className="flex items-start gap-3">
                          <div
                            className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                              isUrgent
                                ? 'bg-red-50 text-red-600'
                                : isImportant
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-[#f1f5fb] text-[#0b3d91]'
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
                              <span className="text-[11px] font-mono-num text-[#64748b] whitespace-nowrap">
                                {n.priority} · {n.createdAt}
                              </span>
                            </div>
                            <p className="text-xs sm:text-sm text-[#475569] mt-1 whitespace-pre-line leading-relaxed">
                              {n.body}
                            </p>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
