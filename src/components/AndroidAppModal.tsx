import { X, Smartphone, Download, ShieldCheck, CheckCircle2, FileCode2 } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface AndroidAppModalProps {
  open: boolean;
  onClose: () => void;
}

export function AndroidAppModal({ open, onClose }: AndroidAppModalProps) {
  const { canInstallNative, isInstalled, isIOS, install } = usePWAInstall();

  if (!open) return null;

  const downloadCapacitorConfig = () => {
    const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://mutual-investment-2026.app';
    const config = {
      appId: 'com.mutualinvestment2026.app',
      appName: 'MUTUAL INVESTMENT-2026',
      webDir: 'dist',
      server: {
        url: appUrl,
        cleartext: appUrl.startsWith('http://'),
      },
      android: {
        allowMixedContent: true,
        backgroundColor: '#0b3d91',
      },
    };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'capacitor.config.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#08162c]/60 backdrop-blur-xs flex items-end md:items-center justify-center p-0 md:p-4"
      onClick={onClose}
    >
      <div
        className="w-full md:max-w-lg bg-white rounded-t-3xl md:rounded-2xl border border-[#dbe5f3] shadow-2xl p-5 md:p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1.5 bg-slate-200 rounded-full mx-auto mb-3 md:hidden" />
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3.5">
            <img
              src="/pwa-512x512.png"
              alt="MUTUAL INVESTMENT-2026 Android Icon"
              className="w-14 h-14 rounded-2xl border border-[#dce4f0] bg-white object-contain p-1 shadow-xs shrink-0"
            />
            <div>
              <h3 className="font-display text-lg font-bold text-[#0f2444]">Android &amp; Mobile App</h3>
              <p className="text-xs text-[#64748b]">MUTUAL INVESTMENT-2026 · Official MI Logo Launcher Icon</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-[#dbe5f3] text-[#6b7a90] hover:text-[#17324b] hover:bg-slate-50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-sm text-[#17324b]">
          {isInstalled ? (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <div className="font-bold text-emerald-900">Installed as Standalone App</div>
                <p className="text-xs text-emerald-800 mt-0.5">
                  আপনার ফোনে অ্যাপটি ইতোমধ্যে install করা আছে। Offline cache ও Camera KYC চালু আছে।
                </p>
              </div>
            </div>
          ) : canInstallNative ? (
            <div className="p-4 rounded-xl bg-[#eef5ff] border border-[#dbe5f3] space-y-3">
              <div className="font-bold text-[#0b3d91] flex items-center gap-2">
                <Smartphone className="w-4 h-4" />
                Direct Android Installation Ready
              </div>
              <p className="text-xs text-[#475569] leading-relaxed">
                নিচের বাটনে ট্যাপ করলে Chrome থেকে সরাসরি আপনার Android ফোনের Home Screen-এ native app হিসেবে install হবে।
              </p>
              <button
                type="button"
                onClick={() => install()}
                className="w-full min-h-[48px] rounded-xl bg-[#10a85a] hover:bg-[#0d8f4c] text-white font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <Download className="w-4 h-4" />
                Install Android App Now
              </button>
            </div>
          ) : isIOS ? (
            <div className="p-4 rounded-xl bg-[#f8fafc] border border-[#dbe5f3] space-y-2">
              <div className="font-bold text-[#0b3d91]">iPhone / iPad-এ Install করার নিয়ম</div>
              <ol className="list-decimal list-inside text-xs text-[#475569] space-y-1.5 leading-relaxed">
                <li>Safari browser-এ নিচের Share আইকনে ট্যাপ করুন।</li>
                <li>&ldquo;Add to Home Screen&rdquo; অপশন নির্বাচন করুন।</li>
                <li>উপরের ডানদিকে &ldquo;Add&rdquo; চাপলেই অ্যাপ আইকন সেট হয়ে যাবে।</li>
              </ol>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-[#f8fafc] border border-[#dbe5f3] space-y-2">
              <div className="font-bold text-[#0b3d91]">Android Chrome-এ সরাসরি App হিসেবে Install</div>
              <ol className="list-decimal list-inside text-xs text-[#475569] space-y-1.5 leading-relaxed">
                <li>Android ফোনে Google Chrome দিয়ে এই portal-টি খুলুন (iframe preview-এর বাইরে সরাসরি App URL-এ)।</li>
                <li>Chrome menu (⋮) থেকে <b>&ldquo;Install app&rdquo;</b> বা <b>&ldquo;Add to Home screen&rdquo;</b> ট্যাপ করুন।</li>
                <li>Home Screen থেকে খুললেই Address bar ছাড়া পূর্ণ Android App অভিজ্ঞতা পাবেন।</li>
              </ol>
            </div>
          )}

          <div className="p-4 rounded-xl border border-[#dbe5f3] bg-white space-y-2.5">
            <div className="flex items-center gap-2 font-bold text-[#0b3d91]">
              <ShieldCheck className="w-4 h-4 text-[#10a85a]" />
              Android Features Included
            </div>
            <ul className="text-xs text-[#475569] space-y-1.5">
              <li>• Camera & Gallery KYC upload with interactive touch cropper</li>
              <li>• Offline dashboard cache & background service worker</li>
              <li>• Instant client-side 4-page KYC PDF & Member Statement download</li>
              <li>• Thumb-friendly bottom navigation & safe-area mobile layout</li>
            </ul>
          </div>

          <div className="p-4 rounded-xl border border-[#dbe5f3] bg-[#f8fafc] space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="font-bold text-xs text-[#0b3d91] flex items-center gap-1.5">
                <FileCode2 className="w-4 h-4" />
                Play Store / APK Wrapper (Capacitor / TWA)
              </div>
              <button
                type="button"
                onClick={downloadCapacitorConfig}
                className="min-h-[38px] px-3 rounded-lg bg-white border border-[#dbe5f3] text-xs font-bold text-[#0b3d91] hover:bg-[#eef5ff] whitespace-nowrap shrink-0"
              >
                Download capacitor.config.json
              </button>
            </div>
            <p className="text-[11px] text-[#6b7a90] leading-relaxed">
              যদি Google Play Store বা sideload করার জন্য <code className="font-mono">.apk</code> / <code className="font-mono">.aab</code> build করতে চান, তাহলে এই config ফাইলটি Capacitor বা Bubblewrap TWA প্রজেক্টে ব্যবহার করতে পারবেন।
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
