import React, { useState } from 'react';
import { Download, Share, PlusSquare, Smartphone, MoreVertical, X } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'header' | 'mobileBar' | 'mobile';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'header' }) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [guideMode, setGuideMode] = useState<'ios' | 'android' | null>(null);

  // Suppress installation button when already launched as an installed standalone PWA
  if (isInstalled) {
    return null;
  }

  // Show only where browser installation is supported or accurate mobile instructions apply
  const canInstallNatively = isInstallable;
  const canShowGuidedInstructions = !canInstallNatively && (isIOS || isAndroid);

  if (!canInstallNatively && !canShowGuidedInstructions) {
    return null;
  }

  const handleClick = () => {
    if (canInstallNatively) {
      void install();
      return;
    }
    if (isIOS) {
      setGuideMode('ios');
      return;
    }
    if (isAndroid) {
      setGuideMode('android');
    }
  };

  const buttonClassName =
    variant === 'mobile'
      ? 'w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 font-bold py-2.5 px-4 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors'
      : variant === 'mobileBar'
      ? 'inline-flex sm:hidden items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 px-2.5 py-1 rounded-lg font-extrabold text-[11px] transition-colors whitespace-nowrap shadow-sm'
      : 'hidden sm:inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl font-bold text-xs transition-colors whitespace-nowrap';

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        title="Install School App directly from this website"
        className={buttonClassName}
      >
        {canInstallNatively ? (
          <Download
            className={`w-3.5 h-3.5 shrink-0 ${
              variant === 'mobileBar' ? 'text-slate-950' : 'text-amber-500'
            }`}
          />
        ) : (
          <Smartphone
            className={`w-3.5 h-3.5 shrink-0 ${
              variant === 'mobileBar' ? 'text-slate-950' : 'text-amber-500'
            }`}
          />
        )}
        <span>Install School App</span>
      </button>

      {guideMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4 text-left">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <img
                  src="/apple-touch-icon.png"
                  alt="Divine Academy App Icon"
                  className="w-10 h-10 rounded-xl border border-amber-400/50 shrink-0"
                />
                <div>
                  <h3 className="font-serif font-bold text-base text-slate-900 dark:text-white">
                    Install Divine Academy App
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {guideMode === 'ios'
                      ? 'iPhone & iPad Safari Instructions'
                      : 'Android Browser Instructions'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGuideMode(null)}
                aria-label="Close installation guide"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {guideMode === 'ios' ? (
              <ol className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold flex items-center justify-center shrink-0">
                    1
                  </span>
                  <span className="flex items-center gap-1.5 flex-wrap">
                    Open this website in <strong>Safari</strong> and tap the{' '}
                    <Share className="w-4 h-4 text-sky-500 inline" /> <strong>Share</strong> button.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold flex items-center justify-center shrink-0">
                    2
                  </span>
                  <span className="flex items-center gap-1.5 flex-wrap">
                    Scroll down and tap{' '}
                    <PlusSquare className="w-4 h-4 text-slate-700 dark:text-slate-200 inline" />{' '}
                    <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.
                  </span>
                </li>
              </ol>
            ) : (
              <ol className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold flex items-center justify-center shrink-0">
                    1
                  </span>
                  <span className="flex items-center gap-1.5 flex-wrap">
                    Tap the browser menu icon{' '}
                    <MoreVertical className="w-4 h-4 text-slate-700 dark:text-slate-200 inline" />{' '}
                    in the top-right or bottom corner of Chrome, Edge, or Firefox.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold flex items-center justify-center shrink-0">
                    2
                  </span>
                  <span>
                    Select <strong>Install app</strong> or <strong>Add to Home screen</strong> to launch Divine Academy directly from your home screen.
                  </span>
                </li>
              </ol>
            )}

            <button
              type="button"
              onClick={() => setGuideMode(null)}
              className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 font-bold text-xs"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
};
