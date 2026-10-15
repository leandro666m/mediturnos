import React, { useEffect, useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    if (isOnline) {
      // Si volvió la conexión tras estar offline, mostrar toast temporal
      setShowReconnected(true);
      const timer = setTimeout(() => setShowReconnected(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline]);

  if (!isOnline) {
    return (
      <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-xl bg-amber-500 text-white px-3.5 py-2 text-xs font-semibold shadow-lg shadow-amber-500/20 border border-amber-400 animate-in fade-in slide-in-from-bottom-2">
        <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
        <WifiOff className="w-3.5 h-3.5" />
        <span>Modo sin conexión — Los datos se guardan localmente en tu dispositivo.</span>
      </div>
    );
  }

  if (showReconnected) {
    return (
      <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-xl bg-emerald-600 text-white px-3.5 py-2 text-xs font-semibold shadow-lg shadow-emerald-600/20 border border-emerald-500 animate-in fade-in slide-in-from-bottom-2">
        <Wifi className="w-3.5 h-3.5" />
        <span>Conexión restablecida</span>
      </div>
    );
  }

  return null;
};
