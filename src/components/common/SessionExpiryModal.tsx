import React from 'react';
import { Clock, LogOut, ShieldAlert } from 'lucide-react';
import {
  SESSION_TIMEOUT_CONFIG,
  SESSION_WARNING_MESSAGE,
  SESSION_WARNING_TITLE,
} from '../../config/sessionConfig';
import { formatCountdownMMSS } from '../../lib/sessionActivity';

interface SessionExpiryModalProps {
  isOpen: boolean;
  countdownSeconds: number;
  onStayLoggedIn: () => void;
  onLogOutNow: () => void;
}

export const SessionExpiryModal: React.FC<SessionExpiryModalProps> = ({
  isOpen,
  countdownSeconds,
  onStayLoggedIn,
  onLogOutNow,
}) => {
  if (!isOpen) return null;

  const totalWarningSeconds = Math.ceil(SESSION_TIMEOUT_CONFIG.WARNING_BEFORE_LOGOUT_MS / 1000);
  const progressPercent = Math.max(
    0,
    Math.min(100, Math.round((countdownSeconds / totalWarningSeconds) * 100))
  );
  const isUrgent = countdownSeconds <= 30;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-expiry-modal-title"
      aria-describedby="session-expiry-modal-description"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fade-in"
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="bg-slate-950 px-6 py-5 border-b border-slate-800 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h2
              id="session-expiry-modal-title"
              className="font-serif font-bold text-lg text-white leading-tight"
            >
              {SESSION_WARNING_TITLE}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Automatic Session Security Timeout
            </p>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <p
            id="session-expiry-modal-description"
            className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed"
          >
            {SESSION_WARNING_MESSAGE}
          </p>

          <div
            aria-live="polite"
            className={`rounded-xl border p-4 flex items-center justify-between gap-4 ${
              isUrgent
                ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/70'
                : 'bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <Clock
                className={`w-4 h-4 shrink-0 ${
                  isUrgent ? 'text-red-500' : 'text-amber-500'
                }`}
              />
              <span>Automatic logout in</span>
            </div>
            <span
              data-testid="session-countdown"
              className={`font-mono font-bold text-2xl tabular-nums tracking-tight ${
                isUrgent ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-amber-400'
              }`}
            >
              {formatCountdownMMSS(countdownSeconds)}
            </span>
          </div>

          <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                isUrgent ? 'bg-red-500' : 'bg-amber-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-1">
            <button
              type="button"
              onClick={onLogOutNow}
              className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-sm flex items-center justify-center gap-2 whitespace-nowrap transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Log Out Now
            </button>
            <button
              type="button"
              autoFocus
              onClick={onStayLoggedIn}
              className="flex-1 min-h-[44px] px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-sm shadow-sm whitespace-nowrap transition-colors"
            >
              Stay Logged In
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
