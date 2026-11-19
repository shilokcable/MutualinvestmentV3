import { useEffect, useRef, useState } from 'react';
import { X, Camera, Image as ImageIcon, Check, ArrowLeft, ArrowRight, AlertTriangle } from 'lucide-react';
import type { KycData } from '../types';
import { api } from '../api';
import { compressImageData } from '../utils/format';
import { pdfFirstPageToImage } from '../utils/pdfRasterizer';
import { CropModal } from './CropModal';

interface KycWizardModalProps {
  open: boolean;
  token: string;
  initialKyc: KycData | null;
  memberId: string;
  memberName: string;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

type DocKey =
  | 'shareholderNidFront'
  | 'shareholderNidBack'
  | 'memberPhoto'
  | 'tinCertificate'
  | 'passportCopy'
  | 'nomineeNidFront'
  | 'nomineeNidBack'
  | 'nomineePhoto';

interface KycFormState {
  shareholderName: string;
  fatherName: string;
  motherName: string;
  spouseName: string;
  dob: string;
  maritalStatus: string;
  profession: string;
  presentAddress: string;
  permanentAddress: string;
  bdPhone: string;
  whatsapp: string;
  overseasPhone: string;
  email: string;
  nidNumber: string;
  tinNumber: string;
  passportNumber: string;
  nomineeName: string;
  nomineeNid: string;
  nomineeDob: string;
  nomineeRelation: string;
  nomineePhone: string;
  nomineeAddress: string;
  notes: string;
}

export function KycWizardModal({
  open,
  token,
  initialKyc,
  memberId,
  memberName,
  onClose,
  onSuccess,
}: KycWizardModalProps) {
  const [step, setStep] = useState(1);
  const [statusMsg, setStatusMsg] = useState('');
  const [isError, setIsError] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<KycFormState>({
    shareholderName: '',
    fatherName: '',
    motherName: '',
    spouseName: '',
    dob: '',
    maritalStatus: '',
    profession: '',
    presentAddress: '',
    permanentAddress: '',
    bdPhone: '',
    whatsapp: '',
    overseasPhone: '',
    email: '',
    nidNumber: '',
    tinNumber: '',
    passportNumber: '',
    nomineeName: '',
    nomineeNid: '',
    nomineeDob: '',
    nomineeRelation: '',
    nomineePhone: '',
    nomineeAddress: '',
    notes: '',
  });

  const [docs, setDocs] = useState<Partial<Record<DocKey, string>>>({});
  const [docLabels, setDocLabels] = useState<Partial<Record<DocKey, string>>>({});
  const [cropTarget, setCropTarget] = useState<{ key: DocKey; file: File } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activePickKey = useRef<DocKey | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setIsError(false);
    const editMode = Boolean(initialKyc?.completed && initialKyc?.updatePermission);
    setStatusMsg(
      editMode
        ? 'Admin approved update. You may update your KYC now.'
        : 'প্রথমবার KYC পূরণ করুন।'
    );

    setForm({
      shareholderName: initialKyc?.name || memberName || '',
      fatherName: initialKyc?.fatherName || '',
      motherName: initialKyc?.motherName || '',
      spouseName: initialKyc?.spouseName || '',
      dob: initialKyc?.dob || '',
      maritalStatus: initialKyc?.maritalStatus || '',
      profession: initialKyc?.profession || '',
      presentAddress: initialKyc?.presentAddress || '',
      permanentAddress: initialKyc?.permanentAddress || '',
      bdPhone: initialKyc?.bdPhone || '',
      whatsapp: initialKyc?.whatsapp || '',
      overseasPhone: initialKyc?.overseasPhone || '',
      email: initialKyc?.email || '',
      nidNumber: initialKyc?.nidNumber || '',
      tinNumber: initialKyc?.tinNumber || '',
      passportNumber: initialKyc?.passportNumber || '',
      nomineeName: initialKyc?.nomineeName || '',
      nomineeNid: initialKyc?.nomineeNid || '',
      nomineeDob: initialKyc?.nomineeDob || '',
      nomineeRelation: initialKyc?.nomineeRelation || '',
      nomineePhone: initialKyc?.nomineePhone || '',
      nomineeAddress: initialKyc?.nomineeAddress || '',
      notes: initialKyc?.notes || '',
    });

    setDocs({
      shareholderNidFront: initialKyc?.shareholderNidFront || '',
      shareholderNidBack: initialKyc?.shareholderNidBack || '',
      memberPhoto: initialKyc?.memberPhoto || initialKyc?.photoData || '',
      tinCertificate: initialKyc?.tinCertificate || '',
      passportCopy: initialKyc?.passportCopy || '',
      nomineeNidFront: initialKyc?.nomineeNidFront || '',
      nomineeNidBack: initialKyc?.nomineeNidBack || '',
      nomineePhoto: initialKyc?.nomineePhoto || '',
    });
    setDocLabels({});
  }, [open, initialKyc, memberName]);

  if (!open) return null;

  const updateField = <K extends keyof KycFormState>(key: K, val: string) => {
    setForm((prev) => ({ ...prev, [key]: val }));
  };

  const triggerPick = (key: DocKey, mode: 'camera' | 'gallery', facing: 'user' | 'environment' = 'environment', acceptPdf = false) => {
    const el = fileInputRef.current;
    if (!el) return;
    activePickKey.current = key;
    el.accept = acceptPdf ? 'image/*,.pdf' : 'image/*';
    if (mode === 'camera') {
      el.setAttribute('capture', facing);
    } else {
      el.removeAttribute('capture');
    }
    el.value = '';
    el.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const key = activePickKey.current;
    if (!file || !key) return;

    try {
      if (file.type === 'application/pdf') {
        setIsError(false);
        setStatusMsg('PDF প্রথম পৃষ্ঠা প্রক্রিয়াকরণ হচ্ছে...');
        let img = await pdfFirstPageToImage(file);
        if (key === 'tinCertificate') {
          img = await compressImageData(img, 1200, 0.72);
        }
        setDocs((prev) => ({ ...prev, [key]: img }));
        setDocLabels((prev) => ({ ...prev, [key]: 'PDF Page 1' }));
        setStatusMsg('');
      } else {
        setCropTarget({ key, file });
      }
    } catch (err) {
      setIsError(true);
      setStatusMsg(err instanceof Error ? err.message : 'ফাইল লোড করা যায়নি।');
    }
  };

  const handleCropDone = async (dataUrl: string) => {
    if (!cropTarget) return;
    const key = cropTarget.key;
    let finalData = dataUrl;
    if (key === 'tinCertificate') {
      finalData = await compressImageData(dataUrl, 1200, 0.72);
    }
    setDocs((prev) => ({ ...prev, [key]: finalData }));
    setDocLabels((prev) => ({ ...prev, [key]: 'Cropped' }));
    setCropTarget(null);
  };

  const validateStep = (n: number): boolean => {
    setIsError(false);
    setStatusMsg('');
    if (n === 1) {
      if (!form.fatherName.trim() || !form.motherName.trim() || !form.dob || !form.profession.trim()) {
        setIsError(true);
        setStatusMsg('এই ধাপের required (*) তথ্য পূরণ করুন।');
        return false;
      }
    } else if (n === 2) {
      if (!form.presentAddress.trim() || !form.permanentAddress.trim() || !form.bdPhone.trim()) {
        setIsError(true);
        setStatusMsg('বর্তমান ঠিকানা, স্থায়ী ঠিকানা এবং Bangladesh Phone দিন।');
        return false;
      }
    } else if (n === 3) {
      if (!form.nidNumber.trim()) {
        setIsError(true);
        setStatusMsg('Shareholder NID Number দিন।');
        return false;
      }
    } else if (n === 4) {
      if (!docs.shareholderNidFront || !docs.shareholderNidBack || !docs.memberPhoto) {
        setIsError(true);
        setStatusMsg('NID Front, NID Back এবং Shareholder Photo upload করুন।');
        return false;
      }
    } else if (n === 5) {
      if (
        !form.nomineeName.trim() ||
        !form.nomineeNid.trim() ||
        !form.nomineeDob ||
        !form.nomineeRelation.trim()
      ) {
        setIsError(true);
        setStatusMsg('Nominee-এর সব required (*) তথ্য দিন।');
        return false;
      }
    } else if (n === 6) {
      if (!docs.nomineeNidFront || !docs.nomineeNidBack || !docs.nomineePhoto) {
        setIsError(true);
        setStatusMsg('Nominee NID Front, Back এবং Nominee Photo upload করুন।');
        return false;
      }
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep(step)) {
      setStep((s) => Math.min(6, s + 1));
    }
  };

  const prevStep = () => {
    setIsError(false);
    setStatusMsg('');
    setStep((s) => Math.max(1, s - 1));
  };

  const handleSubmit = async () => {
    if (!validateStep(6)) return;
    setSaving(true);
    setIsError(false);
    setStatusMsg('KYC সংরক্ষণ হচ্ছে...');

    try {
      const payload: Record<string, string> = {
        shareholderName: form.shareholderName.trim(),
        nidNumber: form.nidNumber.trim(),
        dob: form.dob,
        fatherName: form.fatherName.trim(),
        motherName: form.motherName.trim(),
        spouseName: form.spouseName.trim(),
        maritalStatus: form.maritalStatus,
        profession: form.profession.trim(),
        email: form.email.trim(),
        bdPhone: form.bdPhone.trim(),
        whatsapp: form.whatsapp.trim(),
        overseasPhone: form.overseasPhone.trim(),
        tinNumber: form.tinNumber.trim(),
        passportNumber: form.passportNumber.trim(),
        permanentAddress: form.permanentAddress.trim(),
        presentAddress: form.presentAddress.trim(),
        nomineeName: form.nomineeName.trim(),
        nomineeNid: form.nomineeNid.trim(),
        nomineeDob: form.nomineeDob,
        nomineeRelation: form.nomineeRelation.trim(),
        nomineePhone: form.nomineePhone.trim(),
        nomineeAddress: form.nomineeAddress.trim(),
        notes: form.notes.trim(),
        shareholderNidFront: docs.shareholderNidFront || '',
        shareholderNidBack: docs.shareholderNidBack || '',
        memberPhoto: docs.memberPhoto || '',
        tinCertificate: docs.tinCertificate || '',
        passportCopy: docs.passportCopy || '',
        nomineeNidFront: docs.nomineeNidFront || '',
        nomineeNidBack: docs.nomineeNidBack || '',
        nomineePhoto: docs.nomineePhoto || '',
      };

      await api.saveKyc(token, payload);
      const editMode = Boolean(initialKyc?.completed && initialKyc?.updatePermission);
      onSuccess(editMode ? 'KYC updated successfully' : 'KYC submitted successfully');
    } catch (err) {
      setIsError(true);
      setStatusMsg('KYC Save Error: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  };

  const renderUploadBox = (
    key: DocKey,
    label: string,
    facing: 'user' | 'environment' = 'environment',
    acceptPdf = false
  ) => {
    const preview = docs[key];
    const tag = docLabels[key];
    return (
      <div className="rounded-xl border border-dashed border-[#c5d6ee] bg-white p-3.5">
        <div className="text-xs font-bold text-[#0b3d91] mb-2">{label}</div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => triggerPick(key, 'camera', facing, acceptPdf)}
            className="flex-1 min-h-[44px] px-3 rounded-lg bg-[#0b3d91] hover:bg-[#082e6e] text-white font-semibold text-xs inline-flex items-center justify-center gap-1.5"
          >
            <Camera className="w-3.5 h-3.5 shrink-0" />
            Camera
          </button>
          <button
            type="button"
            onClick={() => triggerPick(key, 'gallery', facing, acceptPdf)}
            className="flex-1 min-h-[44px] px-3 rounded-lg bg-[#eef5ff] hover:bg-[#e1eeff] text-[#0b3d91] border border-[#dbe5f3] font-semibold text-xs inline-flex items-center justify-center gap-1.5"
          >
            <ImageIcon className="w-3.5 h-3.5 shrink-0" />
            Gallery
          </button>
        </div>
        {preview && (
          <div className="mt-2.5 flex items-center gap-2.5">
            <img
              src={preview}
              alt={label}
              className="w-16 h-12 rounded-lg object-cover border border-[#dbe5f3] bg-[#f8fbff]"
            />
            <span className="text-xs font-semibold text-[#10a85a]">
              ✓ Ready{tag ? ` • ${tag}` : ''}
            </span>
          </div>
        )}
      </div>
    );
  };

  const inputCls =
    'w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-[#dbe5f3] bg-white text-sm text-[#17324b] focus:outline-none focus:ring-2 focus:ring-[#0b3d91]/25 focus:border-[#0b3d91]';
  const labelCls = 'block text-xs font-bold text-[#0b3d91] mb-1.5';

  return (
    <>
      <div className="fixed inset-0 z-50 bg-[#08162c]/60 backdrop-blur-xs flex items-end md:items-center justify-center p-0 md:p-4">
        <div className="w-full md:max-w-4xl bg-white rounded-t-3xl md:rounded-2xl border border-[#dbe5f3] shadow-2xl max-h-[94vh] flex flex-col">
          <div className="p-4 md:p-5 border-b border-[#edf2fa] flex items-start justify-between gap-3 shrink-0">
            <div>
              <h3 className="text-lg font-extrabold text-[#0b3d91]">Shareholder & Nominee KYC</h3>
              <p className="text-xs text-[#6b7a90]">
                Step-by-step • Mobile friendly • Camera + Gallery
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-[#dbe5f3] text-[#6b7a90] hover:text-[#17324b]"
              aria-label="Close KYC"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 md:p-6 overflow-y-auto flex-1 space-y-4">
            <div className="p-3 rounded-xl bg-[#f4f8ff] border border-[#dbe5f3] text-xs text-[#17324b] leading-relaxed">
              <b>KYC ৬টি ছোট ধাপে পূরণ করুন।</b> প্রতিটি ধাপে <b>Next</b> চাপলে পরের অংশে যাবেন। ছবি দিতে Camera অথবা Gallery—দুই option-ই থাকবে। Image document crop সম্পূর্ণ free-size; NID ও TIN/Passport-এর অনুপাত নষ্ট হবে না।
            </div>

            {/* Stepper */}
            <div className="grid grid-cols-6 gap-2">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    if (n < step) setStep(n);
                  }}
                  className={`h-9 rounded-xl font-bold text-xs transition-colors flex items-center justify-center ${
                    n === step
                      ? 'bg-[#0b3d91] text-white'
                      : n < step
                      ? 'bg-[#eafaf1] text-[#10a85a] border border-[#10a85a]/30'
                      : 'bg-[#eef5ff] text-[#6b7a90]'
                  }`}
                >
                  {n < step ? '✓' : n}
                </button>
              ))}
            </div>

            {/* Hidden single shared file picker */}
            <input ref={fileInputRef} type="file" hidden onChange={handleFileChange} />

            {/* Step 1 */}
            {step === 1 && (
              <div className="rounded-2xl border border-[#dbe5f3] bg-[#fbfdff] p-4 md:p-5 space-y-4">
                <div>
                  <h4 className="text-base font-extrabold text-[#0b3d91]">
                    ১. Shareholder Basic Information
                  </h4>
                  <p className="text-xs text-[#6b7a90]">নিজের পরিচয় ও পারিবারিক তথ্য</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div>
                    <label className={labelCls}>Member ID</label>
                    <input className={`${inputCls} bg-slate-50 font-mono-num`} value={memberId} readOnly />
                  </div>
                  <div>
                    <label className={labelCls}>Shareholder Name</label>
                    <input
                      className={inputCls}
                      value={form.shareholderName}
                      onChange={(e) => updateField('shareholderName', e.target.value)}
                      placeholder="Shareholder full name"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Father Name *</label>
                    <input
                      className={inputCls}
                      value={form.fatherName}
                      onChange={(e) => updateField('fatherName', e.target.value)}
                      placeholder="Father's full name"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Mother Name *</label>
                    <input
                      className={inputCls}
                      value={form.motherName}
                      onChange={(e) => updateField('motherName', e.target.value)}
                      placeholder="Mother's full name"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Spouse Name</label>
                    <input
                      className={inputCls}
                      value={form.spouseName}
                      onChange={(e) => updateField('spouseName', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Date of Birth *</label>
                    <input
                      type="date"
                      className={inputCls}
                      value={form.dob}
                      onChange={(e) => updateField('dob', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Marital Status</label>
                    <select
                      className={inputCls}
                      value={form.maritalStatus}
                      onChange={(e) => updateField('maritalStatus', e.target.value)}
                    >
                      <option value="">Select</option>
                      <option>Single</option>
                      <option>Married</option>
                      <option>Widowed</option>
                      <option>Divorced</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Profession *</label>
                    <input
                      className={inputCls}
                      value={form.profession}
                      onChange={(e) => updateField('profession', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2 */}
            {step === 2 && (
              <div className="rounded-2xl border border-[#dbe5f3] bg-[#fbfdff] p-4 md:p-5 space-y-4">
                <div>
                  <h4 className="text-base font-extrabold text-[#0b3d91]">২. Address & Contact</h4>
                  <p className="text-xs text-[#6b7a90]">বর্তমান ও স্থায়ী ঠিকানা এবং যোগাযোগ</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div className="md:col-span-2">
                    <label className={labelCls}>Present Address *</label>
                    <textarea
                      rows={2}
                      className={inputCls}
                      value={form.presentAddress}
                      onChange={(e) => updateField('presentAddress', e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelCls}>Permanent Address *</label>
                    <textarea
                      rows={2}
                      className={inputCls}
                      value={form.permanentAddress}
                      onChange={(e) => updateField('permanentAddress', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Bangladesh Phone *</label>
                    <input
                      inputMode="tel"
                      className={inputCls}
                      value={form.bdPhone}
                      onChange={(e) => updateField('bdPhone', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>WhatsApp Number</label>
                    <input
                      inputMode="tel"
                      className={inputCls}
                      value={form.whatsapp}
                      onChange={(e) => updateField('whatsapp', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Overseas Phone</label>
                    <input
                      inputMode="tel"
                      className={inputCls}
                      value={form.overseasPhone}
                      onChange={(e) => updateField('overseasPhone', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Email</label>
                    <input
                      type="email"
                      className={inputCls}
                      value={form.email}
                      onChange={(e) => updateField('email', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 3 */}
            {step === 3 && (
              <div className="rounded-2xl border border-[#dbe5f3] bg-[#fbfdff] p-4 md:p-5 space-y-4">
                <div>
                  <h4 className="text-base font-extrabold text-[#0b3d91]">
                    ৩. NID & Other Information
                  </h4>
                  <p className="text-xs text-[#6b7a90]">জাতীয় পরিচয়পত্র, TIN ও Passport নম্বর</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div>
                    <label className={labelCls}>Shareholder NID Number *</label>
                    <input
                      className={inputCls}
                      value={form.nidNumber}
                      onChange={(e) => updateField('nidNumber', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>TIN Number</label>
                    <input
                      className={inputCls}
                      value={form.tinNumber}
                      onChange={(e) => updateField('tinNumber', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Passport Number</label>
                    <input
                      className={inputCls}
                      value={form.passportNumber}
                      onChange={(e) => updateField('passportNumber', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 4 */}
            {step === 4 && (
              <div className="rounded-2xl border border-[#dbe5f3] bg-[#fbfdff] p-4 md:p-5 space-y-4">
                <div>
                  <h4 className="text-base font-extrabold text-[#0b3d91]">
                    ৪. Shareholder Documents
                  </h4>
                  <p className="text-xs text-[#6b7a90]">NID, TIN, Passport ও নিজের ছবি</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {renderUploadBox('shareholderNidFront', 'NID Front *')}
                  {renderUploadBox('shareholderNidBack', 'NID Back *')}
                  {renderUploadBox('memberPhoto', 'Shareholder Photo *', 'user')}
                  {renderUploadBox('tinCertificate', 'TIN Certificate (Image / PDF)', 'environment', true)}
                  {renderUploadBox('passportCopy', 'Passport Copy (Image / PDF)', 'environment', true)}
                </div>
              </div>
            )}

            {/* Step 5 */}
            {step === 5 && (
              <div className="rounded-2xl border border-[#dbe5f3] bg-[#fbfdff] p-4 md:p-5 space-y-4">
                <div>
                  <h4 className="text-base font-extrabold text-[#0b3d91]">৫. Nominee Information</h4>
                  <p className="text-xs text-[#6b7a90]">Nominee-এর পরিচয় ও যোগাযোগ</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div>
                    <label className={labelCls}>Nominee Name *</label>
                    <input
                      className={inputCls}
                      value={form.nomineeName}
                      onChange={(e) => updateField('nomineeName', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Nominee NID *</label>
                    <input
                      className={inputCls}
                      value={form.nomineeNid}
                      onChange={(e) => updateField('nomineeNid', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Nominee Date of Birth *</label>
                    <input
                      type="date"
                      className={inputCls}
                      value={form.nomineeDob}
                      onChange={(e) => updateField('nomineeDob', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Nominee Relation *</label>
                    <input
                      className={inputCls}
                      value={form.nomineeRelation}
                      onChange={(e) => updateField('nomineeRelation', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Nominee Phone</label>
                    <input
                      inputMode="tel"
                      className={inputCls}
                      value={form.nomineePhone}
                      onChange={(e) => updateField('nomineePhone', e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelCls}>Nominee Address</label>
                    <textarea
                      rows={2}
                      className={inputCls}
                      value={form.nomineeAddress}
                      onChange={(e) => updateField('nomineeAddress', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 6 */}
            {step === 6 && (
              <div className="rounded-2xl border border-[#dbe5f3] bg-[#fbfdff] p-4 md:p-5 space-y-4">
                <div>
                  <h4 className="text-base font-extrabold text-[#0b3d91]">
                    ৬. Nominee Documents & Final Submit
                  </h4>
                  <p className="text-xs text-[#6b7a90]">Nominee NID, photo এবং final confirmation</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {renderUploadBox('nomineeNidFront', 'Nominee NID Front *')}
                  {renderUploadBox('nomineeNidBack', 'Nominee NID Back *')}
                  {renderUploadBox('nomineePhoto', 'Nominee Photo *', 'user')}
                  <div className="md:col-span-2">
                    <label className={labelCls}>Additional Information / Notes</label>
                    <textarea
                      rows={2}
                      className={inputCls}
                      value={form.notes}
                      onChange={(e) => updateField('notes', e.target.value)}
                    />
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    Submit করার পর KYC locked থাকবে। পরে পরিবর্তন দরকার হলে Profile থেকে Admin-এর কাছে Update Request পাঠাতে হবে। Admin approve করলে আবার এই form-এ update করা যাবে।
                  </span>
                </div>
              </div>
            )}

            {statusMsg && (
              <div
                className={`text-sm font-bold px-3 py-2 rounded-xl ${
                  isError ? 'bg-red-50 text-red-700' : 'bg-[#eef5ff] text-[#0b3d91]'
                }`}
              >
                {statusMsg}
              </div>
            )}
          </div>

          <div className="p-4 md:p-5 border-t border-[#edf2fa] flex items-center justify-between gap-3 shrink-0 bg-white rounded-b-2xl">
            {step > 1 ? (
              <button
                type="button"
                onClick={prevStep}
                className="min-h-[44px] px-4 rounded-xl bg-[#eef5ff] hover:bg-[#e1eeff] text-[#0b3d91] font-bold text-sm inline-flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            ) : (
              <span />
            )}

            {step < 6 ? (
              <button
                type="button"
                onClick={nextStep}
                className="min-h-[44px] px-5 rounded-xl bg-[#0b3d91] hover:bg-[#082e6e] text-white font-bold text-sm inline-flex items-center gap-1.5"
              >
                Next
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={saving}
                onClick={handleSubmit}
                className="min-h-[44px] px-6 rounded-xl bg-[#10a85a] hover:bg-[#0d8f4c] disabled:opacity-60 text-white font-bold text-sm inline-flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                {saving ? 'Saving...' : 'Submit KYC'}
              </button>
            )}
          </div>
        </div>
      </div>

      <CropModal
        file={cropTarget?.file || null}
        onCancel={() => setCropTarget(null)}
        onCropComplete={handleCropDone}
      />
    </>
  );
}
