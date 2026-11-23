/**
 * Helpers for protecting active CBT examination sessions from PWA service worker
 * reloads and formatting resilient network error messages across devices.
 */

export const CBT_ACTIVE_ATTR_SELECTOR = '[data-cbt-exam-active="true"]';
export const CBT_ACTIVE_STORAGE_PREFIX = 'cbt_active_exam_';

/**
 * Returns true if a student currently has a CBT examination open or marked active
 * in sessionStorage. Used to strictly block service-worker reloads mid-exam.
 */
export function hasActiveCBTExamSession(): boolean {
  try {
    if (typeof document !== 'undefined' && document.querySelector(CBT_ACTIVE_ATTR_SELECTOR)) {
      return true;
    }
  } catch {
    // Ignore DOM access errors in non-browser contexts
  }

  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      for (let i = 0; i < window.sessionStorage.length; i += 1) {
        const key = window.sessionStorage.key(i);
        if (key && key.startsWith(CBT_ACTIVE_STORAGE_PREFIX)) {
          const val = window.sessionStorage.getItem(key);
          if (val && val.trim().length > 0) {
            return true;
          }
        }
      }
    }
  } catch {
    // Ignore restricted sessionStorage errors
  }

  return false;
}

/**
 * Only permit PWA service-worker reload transitions when no CBT exam is active.
 */
export function shouldAllowServiceWorkerReload(): boolean {
  return !hasActiveCBTExamSession();
}

export function isStandalonePWAMode(): boolean {
  if (typeof window === 'undefined') return false;
  const displayModeMatch =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;
  const iosStandalone =
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return Boolean(displayModeMatch || iosStandalone);
}

/**
 * Translates low-level browser fetch / network errors into clear, actionable
 * guidance for mobile, tablet, and desktop users.
 */
export function formatFriendlyNetworkError(error: unknown, fallback?: string): string {
  const rawMessage =
    error instanceof Error ? error.message : typeof error === 'string' ? error : '';

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'You appear to be offline. Please reconnect to the internet to sync school records or submit CBT exams.';
  }

  if (/failed to fetch|networkerror|load failed|network request failed|err_internet_disconnected/i.test(rawMessage)) {
    return 'Network connection interrupted while reaching the school server. Check your internet connection and try again.';
  }

  if (/timeout|timed out|aborted/i.test(rawMessage)) {
    return 'The server took too long to respond. Please verify your connection and retry.';
  }

  return rawMessage || fallback || 'A network error occurred. Please try again.';
}
