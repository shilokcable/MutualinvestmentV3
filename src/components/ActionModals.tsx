import { useEffect, useRef, useState } from 'react';
import { X, Camera, Image as ImageIcon, FileDown, User } from 'lucide-react';
import type { KycData, KycRequestItem, MemberSummary } from '../types';
import { api } from '../api';
import { CropModal } from './CropModal';
import { generateKycPdf } from '../utils/pdfGenerator';

const inputCls =
  'w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-[#dbe5f3] bg-white text-sm text-[#17324b] focus:outline-none focus:ring-2 focus:ring-[#0b3d91]/25 focus:border-[#0b3d91]';
const labelCls = 'block text-xs font-bold text-[#0b3d91] mb-1';

export function RequestUpdateModal({
  open,
  token,
  onClose,
  onSuccess,
}: {
  open: boolean;
  token: string;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setText('');
      setErr('');
    }
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    if (!text.trim()) {
      setErr('পরিবর্তনের তথ্য লিখুন।');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      await api.submitKycRequest(token, text.trim());
      onSuccess('Request sent to Admin.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#08162c]/60 backdrop-blur-xs flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="w-full md:max-w-md bg-white rounded-t-3xl md:rounded-2xl border border-[#dbe5f3] shadow-2xl p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="text-lg font-extrabold text-[#0b3d91]">Request KYC Update</h3>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-[#dbe5f3] text-[#6b7a90]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-[#6b7a90] mb-3 leading-relaxed">
          KYC একবার submit করার পর সরাসরি edit করা যাবে না। কোন তথ্য পরিবর্তন করতে চান তা লিখুন।
        </p>
        <textarea
          rows={3}
          className={inputCls}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="যেমন: বর্তমান ঠিকানা পরিবর্তন করতে চাই..."
        />
        {err && <div className="text-xs font-bold text-red-600 mt-2">{err}</div>}
        <div className="flex gap-2.5 mt-4">
          <button
            type="button"
            disabled={busy}
            onClick={submit}
            className="flex-1 min-h-[44px] rounded-xl bg-[#0b3d91] hover:bg-[#082e6e] text-white font-bold text-sm"
          >
            {busy ? 'Sending...' : 'Send Request to Admin'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 rounded-xl bg-[#eef5ff] text-[#0b3d91] font-bold text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export function ChangePhotoModal({
  open,
  token,
  onClose,
  onSuccess,
}: {
  open: boolean;
  token: string;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const [croppedData, setCroppedData] = useState('');
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setCroppedData('');
      setCropFile(null);
      setErr('');
    }
  }, [open]);

  if (!open) return null;

  const pick = (mode: 'camera' | 'gallery') => {
    const el = inputRef.current;
    if (!el) return;
    if (mode === 'camera') el.setAttribute('capture', 'user');
    else el.removeAttribute('capture');
    el.value = '';
    el.click();
  };

  const save = async () => {
    if (!croppedData) {
      setErr('ছবি নির্বাচন করে Crop & Use করুন।');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      await api.changeProfilePhoto(token, croppedData);
      onSuccess('Profile photo updated.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-[#08162c]/60 backdrop-blur-xs flex items-end md:items-center justify-center p-0 md:p-4">
        <div className="w-full md:max-w-md bg-white rounded-t-3xl md:rounded-2xl border border-[#dbe5f3] shadow-2xl p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="text-lg font-extrabold text-[#0b3d91]">Change Profile Photo</h3>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-[#dbe5f3] text-[#6b7a90]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-xs text-[#6b7a90] mb-3">
            Camera অথবা Gallery থেকে ছবি নিন, তারপর free-size crop করুন।
          </p>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => pick('camera')}
              className="flex-1 min-h-[44px] rounded-xl bg-[#0b3d91] text-white font-bold text-xs sm:text-sm inline-flex items-center justify-center gap-2"
            >
              <Camera className="w-4 h-4" />
              Camera
            </button>
            <button
              type="button"
              onClick={() => pick('gallery')}
              className="flex-1 min-h-[44px] rounded-xl bg-[#eef5ff] text-[#0b3d91] border border-[#dbe5f3] font-bold text-xs sm:text-sm inline-flex items-center justify-center gap-2"
            >
              <ImageIcon className="w-4 h-4" />
              Gallery
            </button>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setCropFile(f);
            }}
          />
          {croppedData && (
            <div className="mt-3 flex items-center gap-3">
              <img
                src={croppedData}
                alt="Preview"
                className="w-16 h-16 rounded-xl object-cover border border-[#dbe5f3]"
              />
              <span className="text-xs font-bold text-[#10a85a]">✓ Cropped & Ready</span>
            </div>
          )}
          {err && <div className="text-xs font-bold text-red-600 mt-2">{err}</div>}
          <div className="flex gap-2.5 mt-4">
            <button
              type="button"
              disabled={busy}
              onClick={save}
              className="flex-1 min-h-[44px] rounded-xl bg-[#10a85a] hover:bg-[#0d8f4c] text-white font-bold text-sm"
            >
              {busy ? 'Saving...' : 'Save Profile Photo'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 rounded-xl bg-[#eef5ff] text-[#0b3d91] font-bold text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      <CropModal
        file={cropFile}
        onCancel={() => setCropFile(null)}
        onCropComplete={(d) => {
          setCroppedData(d);
          setCropFile(null);
        }}
      />
    </>
  );
}

export function MemberEditModal({
  member,
  token,
  onClose,
  onSuccess,
}: {
  member: MemberSummary | null;
  token: string;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [status, setStatus] = useState('Active');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (member) {
      setName(member.name || '');
      setMobile(member.mobile || '');
      setStatus(member.status || 'Active');
      setPassword('');
      setErr('');
    }
  }, [member]);

  if (!member) return null;

  const save = async () => {
    setBusy(true);
    setErr('');
    try {
      await api.updateMember(token, member.id, { name, mobile, status, password });
      onSuccess('Member updated');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#08162c]/60 backdrop-blur-xs flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="w-full md:max-w-md bg-white rounded-t-3xl md:rounded-2xl border border-[#dbe5f3] shadow-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-[#0b3d91]">Edit Member</h3>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-[#dbe5f3] text-[#6b7a90]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div>
          <label className={labelCls}>Member ID</label>
          <input className={`${inputCls} bg-slate-50 font-mono-num`} value={member.id} readOnly />
        </div>
        <div>
          <label className={labelCls}>Name</label>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Mobile</label>
          <input className={inputCls} value={mobile} onChange={(e) => setMobile(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Status</label>
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option>Active</option>
            <option>Inactive</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>New Password (optional)</label>
          <input
            type="password"
            className={inputCls}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Leave blank to keep existing"
          />
        </div>
        {err && <div className="text-xs font-bold text-red-600">{err}</div>}
        <div className="flex gap-2.5 pt-2">
          <button
            type="button"
            disabled={busy}
            onClick={save}
            className="flex-1 min-h-[44px] rounded-xl bg-[#0b3d91] text-white font-bold text-sm"
          >
            {busy ? 'Saving...' : 'Save'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 rounded-xl bg-[#eef5ff] text-[#0b3d91] font-bold text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export function AddMemberModal({
  open,
  suggestedId,
  token,
  onClose,
  onSuccess,
}: {
  open: boolean;
  suggestedId: string;
  token: string;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const [memberId, setMemberId] = useState('');
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('1234');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setMemberId(suggestedId);
      setName('');
      setMobile('');
      setPassword('1234');
      setErr('');
    }
  }, [open, suggestedId]);

  if (!open) return null;

  const save = async () => {
    if (!memberId.trim() || !name.trim()) {
      setErr('Member ID এবং Name দিন।');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      await api.addMember(token, {
        memberId: memberId.trim().toUpperCase(),
        name: name.trim(),
        mobile: mobile.trim(),
        status: 'Active',
        password: password.trim() || '1234',
      });
      onSuccess(`Member added: ${memberId.trim().toUpperCase()}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to add member');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#08162c]/60 backdrop-blur-xs flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="w-full md:max-w-md bg-white rounded-t-3xl md:rounded-2xl border border-[#dbe5f3] shadow-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-[#0b3d91]">Add New Member</h3>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-[#dbe5f3] text-[#6b7a90]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div>
          <label className={labelCls}>Member ID *</label>
          <input
            className={`${inputCls} font-mono-num uppercase`}
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            placeholder="MI-01"
          />
        </div>
        <div>
          <label className={labelCls}>Full Name *</label>
          <input
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Shareholder Name"
          />
        </div>
        <div>
          <label className={labelCls}>Mobile</label>
          <input
            inputMode="tel"
            className={inputCls}
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            placeholder="017XX-XXXXXX"
          />
        </div>
        <div>
          <label className={labelCls}>Initial Password</label>
          <input
            className={inputCls}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="1234"
          />
        </div>
        {err && <div className="text-xs font-bold text-red-600">{err}</div>}
        <div className="flex gap-2.5 pt-2">
          <button
            type="button"
            disabled={busy}
            onClick={save}
            className="flex-1 min-h-[44px] rounded-xl bg-[#10a85a] text-white font-bold text-sm"
          >
            {busy ? 'Creating...' : 'Create Member'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 rounded-xl bg-[#eef5ff] text-[#0b3d91] font-bold text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export function ReviewKycModal({
  target,
  token,
  onClose,
  onSuccess,
}: {
  target: { item: KycRequestItem; action: 'Approved' | 'Rejected' } | null;
  token: string;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (target) {
      setNote(target.item.adminNote || '');
      setErr('');
    }
  }, [target]);

  if (!target) return null;

  const confirm = async () => {
    setBusy(true);
    setErr('');
    try {
      await api.reviewKycRequest(token, target.item.id, target.action, note.trim());
      onSuccess(
        target.action === 'Approved' ? 'KYC update approved' : 'KYC update request rejected'
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const isApprove = target.action === 'Approved';

  return (
    <div className="fixed inset-0 z-50 bg-[#08162c]/60 backdrop-blur-xs flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="w-full md:max-w-md bg-white rounded-t-3xl md:rounded-2xl border border-[#dbe5f3] shadow-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-[#0b3d91]">
            {isApprove ? 'Approve KYC Update' : 'Reject KYC Update'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-[#dbe5f3] text-[#6b7a90]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-3 rounded-xl bg-[#f8fbff] border border-[#dbe5f3] text-xs space-y-1">
          <div className="font-bold text-[#0b3d91]">
            {target.item.name} ({target.item.memberId})
          </div>
          <div className="text-[#475569]">{target.item.request}</div>
        </div>
        <div>
          <label className={labelCls}>
            {isApprove ? 'Approval Note (optional)' : 'Rejection Reason'}
          </label>
          <textarea
            rows={2}
            className={inputCls}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={isApprove ? 'Optional note for member...' : 'Reason for rejecting...'}
          />
        </div>
        {err && <div className="text-xs font-bold text-red-600">{err}</div>}
        <div className="flex gap-2.5 pt-2">
          <button
            type="button"
            disabled={busy}
            onClick={confirm}
            className={`flex-1 min-h-[44px] rounded-xl text-white font-bold text-sm ${
              isApprove ? 'bg-[#10a85a] hover:bg-[#0d8f4c]' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {busy ? 'Processing...' : isApprove ? 'Confirm Approve' : 'Confirm Reject'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 rounded-xl bg-[#eef5ff] text-[#0b3d91] font-bold text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminViewKycModal({
  memberId,
  token,
  onClose,
}: {
  memberId: string | null;
  token: string;
  onClose: () => void;
}) {
  const [kyc, setKyc] = useState<KycData | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!memberId) {
      setKyc(null);
      return;
    }
    setLoading(true);
    setErr('');
    api
      .getKyc(token, true, memberId)
      .then((res) => setKyc(res.kyc))
      .catch((e) => setErr(e instanceof Error ? e.message : 'Failed to load KYC'))
      .finally(() => setLoading(false));
  }, [memberId, token]);

  if (!memberId) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#08162c]/60 backdrop-blur-xs flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="w-full md:max-w-2xl bg-white rounded-t-3xl md:rounded-2xl border border-[#dbe5f3] shadow-2xl p-5 max-h-[90vh] overflow-y-auto space-y-4">
        <div className="flex items-center justify-between gap-3 border-b border-[#edf2fa] pb-3">
          <div>
            <h3 className="text-lg font-extrabold text-[#0b3d91]">Member KYC Record</h3>
            <p className="text-xs text-[#6b7a90] font-mono-num">{memberId}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-[#dbe5f3] text-[#6b7a90]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="py-10 text-center text-sm text-[#6b7a90]">Loading KYC data...</div>
        ) : err ? (
          <div className="py-6 text-center text-sm font-bold text-red-600">{err}</div>
        ) : kyc ? (
          <>
            <div className="flex items-center gap-4">
              {kyc.photoData ? (
                <img
                  src={kyc.photoData}
                  alt={kyc.name}
                  className="w-20 h-20 rounded-2xl object-cover border border-[#dbe5f3]"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-[#eef5ff] border border-[#dbe5f3] flex items-center justify-center text-[#0b3d91]">
                  <User className="w-8 h-8" />
                </div>
              )}
              <div>
                <div className="text-base font-extrabold text-[#0b3d91]">{kyc.name}</div>
                <div className="text-xs text-[#6b7a90]">
                  Status: <b>{kyc.completed ? 'Completed' : 'Pending'}</b> · Submitted: {kyc.updated || '—'}
                </div>
                {kyc.completed && (
                  <button
                    type="button"
                    onClick={() => generateKycPdf(kyc)}
                    className="mt-2 min-h-[38px] px-3.5 rounded-xl bg-[#10a85a] text-white font-bold text-xs inline-flex items-center gap-1.5"
                  >
                    <FileDown className="w-4 h-4" />
                    Download KYC PDF
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              {[
                ['NID', kyc.nidNumber],
                ['DOB', kyc.dob],
                ['Father', kyc.fatherName],
                ['Mother', kyc.motherName],
                ['Profession', kyc.profession],
                ['BD Phone', kyc.bdPhone],
                ['Nominee', kyc.nomineeName],
                ['Nominee NID', kyc.nomineeNid],
                ['Relation', kyc.nomineeRelation],
              ].map(([l, v]) => (
                <div key={l} className="p-2.5 rounded-xl bg-[#f8fbff] border border-[#dbe5f3]">
                  <div className="text-[#6b7a90]">{l}</div>
                  <div className="font-bold text-[#17324b] mt-0.5 break-words">{v || '—'}</div>
                </div>
              ))}
            </div>

            {kyc.completed && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  ['Shareholder NID Front', kyc.shareholderNidFront],
                  ['Shareholder NID Back', kyc.shareholderNidBack],
                  ['Nominee NID Front', kyc.nomineeNidFront],
                  ['Nominee NID Back', kyc.nomineeNidBack],
                ].map(([t, src]) =>
                  src ? (
                    <div key={t} className="border border-[#dbe5f3] rounded-xl p-2 bg-[#f8fbff]">
                      <div className="text-[11px] font-bold text-[#0b3d91] mb-1">{t}</div>
                      <img src={src} alt={t} className="w-full h-24 object-cover rounded-lg" />
                    </div>
                  ) : null
                )}
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
