import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import type { DashboardData, KycData, KycRequestItem, MemberSummary, UserRole } from './types';
import { OfflineIndicator } from './components/OfflineIndicator';
import { AndroidAppModal } from './components/AndroidAppModal';
import { LoginView } from './components/LoginView';
import { MemberDashboard } from './components/MemberDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { ProfileDrawer } from './components/ProfileDrawer';
import { KycWizardModal } from './components/KycWizardModal';
import {
  AddMemberModal,
  AdminViewKycModal,
  ChangePhotoModal,
  MemberEditModal,
  RequestUpdateModal,
  ReviewKycModal,
} from './components/ActionModals';
import { Toast } from './components/Toast';
import { generateKycPdf } from './utils/pdfGenerator';

const SESSION_KEY = 'mutual_inv_2026_session';

export default function App() {
  const [token, setToken] = useState<string>(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      return saved ? JSON.parse(saved).token || '' : '';
    } catch {
      return '';
    }
  });
  const [role, setRole] = useState<UserRole | ''>(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      return saved ? JSON.parse(saved).role || '' : '';
    } catch {
      return '';
    }
  });

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loadingDash, setLoadingDash] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' }>({
    msg: '',
    type: 'success',
  });

  const notify = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
  }, []);

  useEffect(() => {
    if (!toast.msg) return;
    const t = setTimeout(() => setToast({ msg: '', type: 'success' }), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // Modals / Drawers state
  const [androidModalOpen, setAndroidModalOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [kycModalOpen, setKycModalOpen] = useState(false);
  const [kycWizardData, setKycWizardData] = useState<KycData | null>(null);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);

  // Admin modals
  const [editingMember, setEditingMember] = useState<MemberSummary | null>(null);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<{
    item: KycRequestItem;
    action: 'Approved' | 'Rejected';
  } | null>(null);
  const [viewKycMemberId, setViewKycMemberId] = useState<string | null>(null);

  const loadDashboard = useCallback(
    async (activeToken: string, promptKycIfPending = false) => {
      if (!activeToken) return;
      setLoadingDash(true);
      try {
        const res = await api.getDashboard(activeToken);
        setDashboard(res);
        if (promptKycIfPending && res.role === 'member' && (!res.kyc || !res.kyc.completed)) {
          setTimeout(() => {
            setKycWizardData(res.kyc);
            setKycModalOpen(true);
          }, 400);
        }
      } catch (err) {
        setToken('');
        setRole('');
        setDashboard(null);
        sessionStorage.removeItem(SESSION_KEY);
        notify(err instanceof Error ? err.message : 'Session expired', 'error');
      } finally {
        setLoadingDash(false);
      }
    },
    [notify]
  );

  useEffect(() => {
    if (token && role) {
      loadDashboard(token, false);
    }
  }, []); // initial restore only

  const handleLoginSuccess = (newToken: string, newRole: UserRole) => {
    setToken(newToken);
    setRole(newRole);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token: newToken, role: newRole }));
    loadDashboard(newToken, true);
  };

  const handleLogout = async () => {
    if (token) {
      await api.logout(token);
    }
    setToken('');
    setRole('');
    setDashboard(null);
    setProfileOpen(false);
    setKycModalOpen(false);
    sessionStorage.removeItem(SESSION_KEY);
  };

  const handleOpenKyc = async () => {
    if (!token) return;
    try {
      const { kyc } = await api.getKyc(token, true);
      if (kyc.completed && !kyc.updatePermission) {
        setProfileOpen(true);
        return;
      }
      setProfileOpen(false);
      setKycWizardData(kyc);
      setKycModalOpen(true);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'KYC load failed', 'error');
    }
  };

  const suggestedMemberId = (() => {
    if (!dashboard || dashboard.role !== 'admin') return 'MI-01';
    const existing = new Set(dashboard.members.map((m) => m.id.toUpperCase()));
    let n = 1;
    while (existing.has(`MI-${String(n).padStart(2, '0')}`)) n++;
    return `MI-${String(n).padStart(2, '0')}`;
  })();

  return (
    <>
      <OfflineIndicator />

      {!token || !dashboard ? (
        loadingDash && token ? (
          <div className="min-h-screen flex items-center justify-center text-sm font-bold text-[#0b3d91]">
            Loading MUTUAL INVESTMENT-2026...
          </div>
        ) : (
          <LoginView
            onLoginSuccess={handleLoginSuccess}
            onOpenAndroidGuide={() => setAndroidModalOpen(true)}
          />
        )
      ) : dashboard.role === 'member' ? (
        <>
          <MemberDashboard
            data={dashboard}
            token={token}
            onOpenProfile={() => setProfileOpen(true)}
            onOpenKyc={handleOpenKyc}
            onOpenPhotoModal={() => setPhotoModalOpen(true)}
            onOpenRequestModal={() => setRequestModalOpen(true)}
            onOpenAndroidGuide={() => setAndroidModalOpen(true)}
            onLogout={handleLogout}
            onNotify={notify}
          />

          <ProfileDrawer
            open={profileOpen}
            kyc={dashboard.kyc}
            memberName={dashboard.name}
            memberId={dashboard.memberId}
            onClose={() => setProfileOpen(false)}
            onDownloadPdf={async () => {
              try {
                await generateKycPdf(dashboard.kyc);
                notify('KYC PDF downloaded');
              } catch (e) {
                notify(e instanceof Error ? e.message : 'PDF error', 'error');
              }
            }}
            onOpenPhotoModal={() => {
              setProfileOpen(false);
              setPhotoModalOpen(true);
            }}
            onOpenRequestModal={() => {
              setProfileOpen(false);
              setRequestModalOpen(true);
            }}
            onOpenKycWizard={handleOpenKyc}
          />

          <KycWizardModal
            open={kycModalOpen}
            token={token}
            initialKyc={kycWizardData || dashboard.kyc}
            memberId={dashboard.memberId}
            memberName={dashboard.name}
            onClose={() => setKycModalOpen(false)}
            onSuccess={(msg) => {
              setKycModalOpen(false);
              notify(msg);
              loadDashboard(token, false);
            }}
          />

          <RequestUpdateModal
            open={requestModalOpen}
            token={token}
            onClose={() => setRequestModalOpen(false)}
            onSuccess={(msg) => {
              setRequestModalOpen(false);
              notify(msg);
              loadDashboard(token, false);
            }}
          />

          <ChangePhotoModal
            open={photoModalOpen}
            token={token}
            onClose={() => setPhotoModalOpen(false)}
            onSuccess={(msg) => {
              setPhotoModalOpen(false);
              notify(msg);
              loadDashboard(token, false);
            }}
          />
        </>
      ) : (
        <>
          <AdminDashboard
            data={dashboard}
            token={token}
            onRefresh={() => loadDashboard(token, false)}
            onEditMember={(m) => setEditingMember(m)}
            onAddMember={() => setAddMemberOpen(true)}
            onReviewKyc={(item, action) => setReviewTarget({ item, action })}
            onViewMemberKyc={(id) => setViewKycMemberId(id)}
            onOpenAndroidGuide={() => setAndroidModalOpen(true)}
            onLogout={handleLogout}
            onNotify={notify}
          />

          <MemberEditModal
            member={editingMember}
            token={token}
            onClose={() => setEditingMember(null)}
            onSuccess={(msg) => {
              setEditingMember(null);
              notify(msg);
              loadDashboard(token, false);
            }}
          />

          <AddMemberModal
            open={addMemberOpen}
            suggestedId={suggestedMemberId}
            token={token}
            onClose={() => setAddMemberOpen(false)}
            onSuccess={(msg) => {
              setAddMemberOpen(false);
              notify(msg);
              loadDashboard(token, false);
            }}
          />

          <ReviewKycModal
            target={reviewTarget}
            token={token}
            onClose={() => setReviewTarget(null)}
            onSuccess={(msg) => {
              setReviewTarget(null);
              notify(msg);
              loadDashboard(token, false);
            }}
          />

          <AdminViewKycModal
            memberId={viewKycMemberId}
            token={token}
            onClose={() => setViewKycMemberId(null)}
          />
        </>
      )}

      <AndroidAppModal open={androidModalOpen} onClose={() => setAndroidModalOpen(false)} />

      <Toast
        message={toast.msg}
        type={toast.type}
        onClose={() => setToast({ msg: '', type: 'success' })}
      />
    </>
  );
}
