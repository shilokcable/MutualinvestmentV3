import { X, FileDown, Camera, Mail, Edit3, User } from 'lucide-react';
import type { KycData } from '../types';

interface ProfileDrawerProps {
  open: boolean;
  kyc: KycData | null;
  memberName: string;
  memberId: string;
  onClose: () => void;
  onDownloadPdf: () => void;
  onOpenPhotoModal: () => void;
  onOpenRequestModal: () => void;
  onOpenKycWizard: () => void;
}

export function ProfileDrawer({
  open,
  kyc,
  memberName,
  memberId,
  onClose,
  onDownloadPdf,
  onOpenPhotoModal,
  onOpenRequestModal,
  onOpenKycWizard,
}: ProfileDrawerProps) {
  if (!open) return null;

  const photo = kyc?.photoData || kyc?.memberPhoto || '';
  const completed = Boolean(kyc?.completed);

  const infoItem = (label: string, val?: string, full = false) => (
    <div
      className={`rounded-xl border border-[#e2e8f2] bg-[#f8fafd] p-2.5 ${full ? 'col-span-2' : ''}`}
    >
      <div className="text-[11px] font-medium text-[#64748b]">{label}</div>
      <div className="text-xs sm:text-sm font-semibold text-[#13294b] mt-0.5 break-words">
        {val || '—'}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="fixed inset-0 bg-[#08162c]/55 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />
      <aside className="relative z-10 w-full max-w-md bg-white h-full overflow-y-auto shadow-2xl border-l border-[#dce4f0] p-5 sm:p-6 pb-10">
        <div className="flex items-center justify-between gap-3 pb-4 border-b border-[#edf2f8]">
          <h3 className="font-display text-lg font-bold text-[#0f2444]">Shareholder Profile</h3>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-[#d6e0ee] text-[#64748b] hover:text-[#13294b] hover:bg-slate-50"
            aria-label="Close profile"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-3.5 py-4 border-b border-[#edf2f8]">
          {photo ? (
            <img
              src={photo}
              alt={kyc?.name || memberName}
              className="w-20 h-20 rounded-2xl object-cover border border-[#dce4f0] bg-[#f1f5fb] shrink-0"
            />
          ) : (
            <div className="w-20 h-20 rounded-2xl border border-[#dce4f0] bg-[#f1f5fb] flex items-center justify-center text-[#0b3d91] shrink-0">
              <User className="w-9 h-9" />
            </div>
          )}
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold text-[#0f2444] truncate">
              {kyc?.name || memberName}
            </h2>
            <div className="text-xs text-[#64748b] font-mono-num mt-0.5">
              {kyc?.memberId || memberId} · {completed ? 'KYC Verified' : 'KYC Pending'}
            </div>
            {kyc?.updatePermission && (
              <div className="text-xs font-semibold text-[#0f9f59] mt-1">
                Admin Approved: Update Enabled
              </div>
            )}
          </div>
        </div>

        <div className="mt-5">
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5b6b82] mb-2.5">
            Shareholder Information
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {infoItem('NID Number', kyc?.nidNumber)}
            {infoItem('Date of Birth', kyc?.dob)}
            {infoItem('Father Name', kyc?.fatherName)}
            {infoItem('Mother Name', kyc?.motherName)}
            {infoItem('Spouse Name', kyc?.spouseName)}
            {infoItem('Marital Status', kyc?.maritalStatus)}
            {infoItem('Profession', kyc?.profession)}
            {infoItem('Bangladesh Phone', kyc?.bdPhone)}
            {infoItem('WhatsApp', kyc?.whatsapp)}
            {infoItem('Overseas Phone', kyc?.overseasPhone)}
            {infoItem('Email', kyc?.email)}
            {infoItem('TIN Number', kyc?.tinNumber)}
            {infoItem('Passport Number', kyc?.passportNumber)}
            {infoItem('Permanent Address', kyc?.permanentAddress, true)}
            {infoItem('Present Address', kyc?.presentAddress, true)}
          </div>
        </div>

        <div className="mt-5">
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5b6b82] mb-2.5">
            Nominee Information
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {infoItem('Nominee Name', kyc?.nomineeName)}
            {infoItem('Nominee NID', kyc?.nomineeNid)}
            {infoItem('Date of Birth', kyc?.nomineeDob)}
            {infoItem('Relation', kyc?.nomineeRelation)}
            {infoItem('Phone', kyc?.nomineePhone)}
            {infoItem('Address', kyc?.nomineeAddress, true)}
          </div>
        </div>

        <div className="mt-5 p-3.5 rounded-xl bg-[#f6f9ff] border border-[#dce4f0] text-xs leading-relaxed text-[#13294b]">
          <div>
            Submitted: <span className="font-semibold font-mono-num">{kyc?.updated || 'Not yet submitted'}</span>
          </div>
          <div className="mt-0.5">
            Status: <span className="font-semibold">{completed ? 'Completed' : 'Pending'}</span>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2.5">
          {completed ? (
            <>
              <button
                type="button"
                onClick={onDownloadPdf}
                className="flex-1 min-h-[44px] px-4 rounded-xl bg-[#0f9f59] hover:bg-[#0c854a] text-white font-semibold text-xs sm:text-sm inline-flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <FileDown className="w-4 h-4 shrink-0" />
                Download KYC PDF
              </button>
              <button
                type="button"
                onClick={onOpenPhotoModal}
                className="min-h-[44px] px-4 rounded-xl bg-[#f1f5fb] hover:bg-[#e5edf9] text-[#0b3d91] border border-[#d6e0ee] font-semibold text-xs sm:text-sm inline-flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <Camera className="w-4 h-4 shrink-0" />
                Change Photo
              </button>
              <button
                type="button"
                onClick={onOpenRequestModal}
                className="min-h-[44px] px-4 rounded-xl bg-[#f1f5fb] hover:bg-[#e5edf9] text-[#0b3d91] border border-[#d6e0ee] font-semibold text-xs sm:text-sm inline-flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <Mail className="w-4 h-4 shrink-0" />
                Request Update
              </button>
              {kyc?.updatePermission && (
                <button
                  type="button"
                  onClick={onOpenKycWizard}
                  className="w-full min-h-[44px] px-4 rounded-xl bg-[#b45309] hover:bg-[#92400e] text-white font-semibold text-sm inline-flex items-center justify-center gap-2"
                >
                  <Edit3 className="w-4 h-4 shrink-0" />
                  Update KYC Now
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={onOpenKycWizard}
              className="w-full min-h-[48px] px-4 rounded-xl bg-[#0f9f59] hover:bg-[#0c854a] text-white font-semibold text-sm"
            >
              Complete KYC (6 Steps)
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}
