import { Smartphone, Download, Check } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  onOpenAndroidGuide: () => void;
  compact?: boolean;
}

export function PWAInstallButton({ onOpenAndroidGuide, compact = false }: PWAInstallButtonProps) {
  const { canInstallNative, isInstalled, install } = usePWAInstall();

  const handleClick = async () => {
    if (canInstallNative) {
      const accepted = await install();
      if (!accepted) {
        onOpenAndroidGuide();
      }
    } else {
      onOpenAndroidGuide();
    }
  };

  if (isInstalled) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 whitespace-nowrap shrink-0">
        <Check className="w-4 h-4" />
        Android App Active
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center justify-center gap-2 min-h-[44px] px-3.5 rounded-xl font-semibold text-sm transition-colors whitespace-nowrap shrink-0 border ${
        canInstallNative
          ? 'bg-[#10a85a] hover:bg-[#0d8f4c] text-white border-transparent shadow-sm'
          : 'bg-white hover:bg-slate-50 text-[#0b3d91] border-[#dbe5f3]'
      }`}
    >
      {canInstallNative ? <Download className="w-4 h-4 shrink-0" /> : <Smartphone className="w-4 h-4 shrink-0" />}
      <span>{compact ? 'Android App' : canInstallNative ? 'Install Android App' : 'Android App / Install'}</span>
    </button>
  );
}
