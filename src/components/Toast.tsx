import { CheckCircle2, AlertCircle, X } from 'lucide-react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error';
  onClose: () => void;
}

export function Toast({ message, type = 'success', onClose }: ToastProps) {
  if (!message) return null;
  const isErr = type === 'error';

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-20 md:bottom-6 right-4 left-4 md:left-auto md:max-w-sm z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-semibold transition-all ${
        isErr
          ? 'bg-red-700 text-white border-red-800'
          : 'bg-[#17324b] text-white border-[#0b3d91]/40'
      }`}
    >
      {isErr ? (
        <AlertCircle className="w-5 h-5 shrink-0 text-red-200" />
      ) : (
        <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
      )}
      <span className="flex-1 leading-snug">{message}</span>
      <button
        type="button"
        onClick={onClose}
        className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
        aria-label="Close notification"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
