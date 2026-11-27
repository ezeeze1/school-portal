import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSchool } from '../../context/SchoolContext';
import {
  SESSION_EXPIRED_LOGOUT_MESSAGE,
  SESSION_TIMEOUT_CONFIG,
} from '../../config/sessionConfig';
import {
  clearScopedSessionSyncStorage,
  hasVerifiedActiveCBTExamExemption,
  readSessionExpiredNotice,
  saveSessionExpiredNotice,
  writeStoredActivityTimestamp,
  type LogoutTriggerReason,
} from '../../lib/sessionActivity';
import { useIdleTimeout } from '../../hooks/useIdleTimeout';
import { SessionExpiryModal } from './SessionExpiryModal';

interface SessionTimeoutContextValue {
  sessionExpiredNotice: string | null;
  shouldOpenLoginModal: boolean;
  consumeLoginModalTrigger: () => void;
  clearSessionExpiredNotice: () => void;
  notifyUserNavigationActivity: () => void;
  cbtExemptionActive: boolean;
}

const SessionTimeoutContext = createContext<SessionTimeoutContextValue>({
  sessionExpiredNotice: null,
  shouldOpenLoginModal: false,
  consumeLoginModalTrigger: () => {},
  clearSessionExpiredNotice: () => {},
  notifyUserNavigationActivity: () => {},
  cbtExemptionActive: false,
});

export const SessionTimeoutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, activeRole, authLoading, currentView, logout } = useSchool();

  const isAuthenticated =
    !authLoading &&
    activeRole !== 'public' &&
    Boolean(currentUser?.role) &&
    currentUser?.role === activeRole;

  const userScope = useMemo(() => {
    if (!isAuthenticated || !currentUser) return null;
    return `${activeRole}:${currentUser.authUserId || currentUser.id}`;
  }, [isAuthenticated, currentUser, activeRole]);

  const [sessionExpiredNotice, setSessionExpiredNotice] = useState<string | null>(() =>
    readSessionExpiredNotice()
  );
  const [shouldOpenLoginModal, setShouldOpenLoginModal] = useState<boolean>(false);

  const wasAuthenticatedRef = useRef(false);
  const logoutGuardActiveRef = useRef(false);
  const lastViewRef = useRef(currentView);

  // When an unauthenticated session transitions into authenticated login,
  // reset any prior expired-session notice and start a fresh activity baseline.
  useEffect(() => {
    if (isAuthenticated && userScope) {
      if (!wasAuthenticatedRef.current) {
        writeStoredActivityTimestamp(userScope, Date.now());
        setSessionExpiredNotice(null);
        saveSessionExpiredNotice(null);
        setShouldOpenLoginModal(false);
        logoutGuardActiveRef.current = false;

        try {
          if (typeof window !== 'undefined' && window.history?.pushState) {
            window.history.pushState(
              { daPortalAuthenticated: true },
              '',
              window.location.pathname + window.location.search
            );
          }
        } catch {
          // Ignore restricted history APIs
        }
      }
      wasAuthenticatedRef.current = true;
    } else {
      wasAuthenticatedRef.current = false;
    }
  }, [isAuthenticated, userScope]);

  const finalizeLogoutUI = useCallback((reason: LogoutTriggerReason) => {
    logoutGuardActiveRef.current = true;
    clearScopedSessionSyncStorage();

    try {
      if (typeof window !== 'undefined' && window.history?.replaceState) {
        window.history.replaceState(
          { daLoggedOut: true },
          '',
          window.location.pathname + window.location.search
        );
      }
    } catch {
      // Ignore history API restrictions
    }

    if (reason === 'inactivity') {
      setSessionExpiredNotice(SESSION_EXPIRED_LOGOUT_MESSAGE);
      saveSessionExpiredNotice(SESSION_EXPIRED_LOGOUT_MESSAGE);
      setShouldOpenLoginModal(true);
    } else {
      setSessionExpiredNotice(null);
      saveSessionExpiredNotice(null);
      setShouldOpenLoginModal(false);
    }
  }, []);

  // Prevent browser Back button from restoring any protected portal view after logout
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlePopState = () => {
      if (!isAuthenticated && logoutGuardActiveRef.current) {
        try {
          window.history.replaceState(
            { daLoggedOut: true },
            '',
            window.location.pathname + window.location.search
          );
        } catch {
          // Ignore history API restrictions
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isAuthenticated]);

  const handleTimeoutLogout = useCallback(async () => {
    // Defense in depth: re-check verified active CBT exemption before enforcing timeout
    if (hasVerifiedActiveCBTExamExemption(undefined, SESSION_TIMEOUT_CONFIG)) {
      return;
    }
    finalizeLogoutUI('inactivity');
    await logout({ reason: 'inactivity' });
  }, [finalizeLogoutUI, logout]);

  const handleManualLogout = useCallback(async () => {
    finalizeLogoutUI('manual');
    await logout({ reason: 'manual' });
  }, [finalizeLogoutUI, logout]);

  const handleRemoteLogout = useCallback(
    (reason: LogoutTriggerReason) => {
      finalizeLogoutUI(reason);
      void logout({ reason, localOnly: true });
    },
    [finalizeLogoutUI, logout]
  );

  const { snapshot, stayLoggedIn, logoutNow, notifyUserActivity } = useIdleTimeout({
    enabled: isAuthenticated,
    userScope,
    config: SESSION_TIMEOUT_CONFIG,
    onTimeoutLogout: handleTimeoutLogout,
    onManualLogout: handleManualLogout,
    onRemoteLogout: handleRemoteLogout,
  });

  // Track user-initiated portal view navigation changes while authenticated
  useEffect(() => {
    if (lastViewRef.current !== currentView) {
      lastViewRef.current = currentView;
      if (isAuthenticated && !snapshot.isWarningOpen) {
        notifyUserActivity(false);
      }
    }
  }, [currentView, isAuthenticated, snapshot.isWarningOpen, notifyUserActivity]);

  const consumeLoginModalTrigger = useCallback(() => {
    setShouldOpenLoginModal(false);
  }, []);

  const clearSessionExpiredNotice = useCallback(() => {
    setSessionExpiredNotice(null);
    saveSessionExpiredNotice(null);
  }, []);

  const notifyUserNavigationActivity = useCallback(() => {
    if (isAuthenticated && !snapshot.isWarningOpen) {
      notifyUserActivity(true);
    }
  }, [isAuthenticated, snapshot.isWarningOpen, notifyUserActivity]);

  const contextValue = useMemo<SessionTimeoutContextValue>(
    () => ({
      sessionExpiredNotice,
      shouldOpenLoginModal,
      consumeLoginModalTrigger,
      clearSessionExpiredNotice,
      notifyUserNavigationActivity,
      cbtExemptionActive: snapshot.cbtExamActive,
    }),
    [
      sessionExpiredNotice,
      shouldOpenLoginModal,
      consumeLoginModalTrigger,
      clearSessionExpiredNotice,
      notifyUserNavigationActivity,
      snapshot.cbtExamActive,
    ]
  );

  return (
    <SessionTimeoutContext.Provider value={contextValue}>
      {children}
      <SessionExpiryModal
        isOpen={isAuthenticated && snapshot.isWarningOpen && !snapshot.cbtExamActive}
        countdownSeconds={snapshot.countdownSeconds}
        onStayLoggedIn={stayLoggedIn}
        onLogOutNow={logoutNow}
      />
    </SessionTimeoutContext.Provider>
  );
};

export const useSessionTimeout = () => useContext(SessionTimeoutContext);
