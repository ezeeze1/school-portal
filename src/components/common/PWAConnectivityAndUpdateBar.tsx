import React, { useEffect, useState } from 'react';
import { RefreshCw, WifiOff, X } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import {
  CBT_ACTIVE_ATTR_SELECTOR,
  hasActiveCBTExamSession,
  shouldAllowServiceWorkerReload,
} from '../../lib/pwaProtection';

export const PWAConnectivityAndUpdateBar: React.FC = () => {
  const isOnline = useOnlineStatus();
  const [examInProgress, setExamInProgress] = useState<boolean>(() => hasActiveCBTExamSession());
  const [dismissedUpdate, setDismissedUpdate] = useState(false);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      // Periodically check for portal updates in the background, skipping active CBT sessions
      window.setInterval(() => {
        if (navigator.onLine && !hasActiveCBTExamSession()) {
          void registration.update();
        }
      }, 60 * 60 * 1000);
    },
  });

  // Track CBT active exam state so service worker updates NEVER interrupt an ongoing exam
  useEffect(() => {
    const syncExamGuard = () => {
      setExamInProgress(hasActiveCBTExamSession());
    };

    syncExamGuard();
    const timer = window.setInterval(syncExamGuard, 2000);
    window.addEventListener('storage', syncExamGuard);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('storage', syncExamGuard);
    };
  }, []);

  const isRunnerMounted =
    typeof document !== 'undefined' && Boolean(document.querySelector(CBT_ACTIVE_ATTR_SELECTOR));

  const showUpdateBanner = needRefresh && !dismissedUpdate && !examInProgress;
  // CBTExamRunner already renders its own dedicated connectivity/sync pill during active exams
  const showOfflineBanner = !isOnline && !isRunnerMounted;

  const handleApplyUpdate = () => {
    if (!shouldAllowServiceWorkerReload()) {
      return;
    }
    void updateServiceWorker(true);
  };

  if (!showUpdateBanner && !showOfflineBanner) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:right-auto sm:max-w-md z-50 space-y-2 pointer-events-none print:hidden">
      {showUpdateBanner && (
        <div className="pointer-events-auto bg-slate-900 text-white border border-amber-500/40 rounded-2xl p-3.5 shadow-2xl flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <RefreshCw className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-white">Portal Update Ready</p>
              <p className="text-[11px] text-slate-300">
                Refresh when convenient to load the latest portal version.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleApplyUpdate}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs transition-colors"
            >
              Update
            </button>
            <button
              type="button"
              onClick={() => {
                setDismissedUpdate(true);
                setNeedRefresh(false);
              }}
              aria-label="Dismiss update notification"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {showOfflineBanner && (
        <div className="pointer-events-auto bg-amber-500 text-slate-950 rounded-2xl px-3.5 py-2.5 shadow-xl flex items-center gap-2.5 text-xs font-bold border border-amber-400">
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>
            You are offline. Portal data sync and CBT exam submissions require an internet connection.
          </span>
        </div>
      )}
    </div>
  );
};
