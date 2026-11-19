import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="alert"
      className="bg-amber-600 text-white text-xs font-semibold px-4 py-2 flex items-center justify-center gap-2 sticky top-0 z-50"
    >
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>Offline Mode — Cached dashboard data active. Changes sync once back online.</span>
    </div>
  );
}
