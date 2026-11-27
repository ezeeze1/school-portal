import { useCallback, useEffect, useRef, useState } from 'react';
import {
  GENUINE_USER_ACTIVITY_EVENTS,
  SESSION_TIMEOUT_CONFIG,
  type SessionTimeoutConfig,
} from '../config/sessionConfig';
import {
  IdleSessionController,
  type IdleControllerSnapshot,
  type LogoutTriggerReason,
} from '../lib/sessionActivity';

export interface UseIdleTimeoutOptions {
  enabled: boolean;
  userScope: string | null;
  config?: SessionTimeoutConfig;
  onTimeoutLogout: () => Promise<void> | void;
  onManualLogout: () => Promise<void> | void;
  onRemoteLogout: (reason: LogoutTriggerReason) => void;
}

const DEFAULT_SNAPSHOT: IdleControllerSnapshot = {
  status: 'active',
  isWarningOpen: false,
  countdownSeconds: Math.ceil(SESSION_TIMEOUT_CONFIG.WARNING_BEFORE_LOGOUT_MS / 1000),
  lastActivityAtMs: 0,
  cbtExamActive: false,
};

export function useIdleTimeout({
  enabled,
  userScope,
  config = SESSION_TIMEOUT_CONFIG,
  onTimeoutLogout,
  onManualLogout,
  onRemoteLogout,
}: UseIdleTimeoutOptions) {
  const [snapshot, setSnapshot] = useState<IdleControllerSnapshot>(DEFAULT_SNAPSHOT);
  const controllerRef = useRef<IdleSessionController | null>(null);

  const onTimeoutRef = useRef(onTimeoutLogout);
  const onManualRef = useRef(onManualLogout);
  const onRemoteRef = useRef(onRemoteLogout);

  useEffect(() => {
    onTimeoutRef.current = onTimeoutLogout;
  }, [onTimeoutLogout]);

  useEffect(() => {
    onManualRef.current = onManualLogout;
  }, [onManualLogout]);

  useEffect(() => {
    onRemoteRef.current = onRemoteLogout;
  }, [onRemoteLogout]);

  useEffect(() => {
    if (!enabled || !userScope) {
      controllerRef.current?.destroy();
      controllerRef.current = null;
      setSnapshot(DEFAULT_SNAPSHOT);
      return;
    }

    const controller = new IdleSessionController({
      userScope,
      config,
      resetStoredTimestampOnStart: false,
      onSnapshotChange: (next) => setSnapshot(next),
      onTimeoutLogout: () => onTimeoutRef.current(),
      onManualLogout: () => onManualRef.current(),
      onRemoteLogout: (reason) => onRemoteRef.current(reason),
    });

    controllerRef.current = controller;

    const handleUserEvent = () => {
      // Do not automatically dismiss an active warning modal from passive mouse drift —
      // require clicking Stay Logged In once the 2-minute warning modal is visible.
      const current = controller.evaluate();
      if (current.isWarningOpen) {
        return;
      }
      controller.recordUserActivity(false);
    };

    const handleResumeCheck = () => {
      controller.evaluate();
    };

    const handleStorage = (event: StorageEvent) => {
      controller.handleStorageEvent(event.key, event.newValue);
    };

    for (const eventName of GENUINE_USER_ACTIVITY_EVENTS) {
      window.addEventListener(eventName, handleUserEvent, { passive: true, capture: true });
    }
    document.addEventListener('visibilitychange', handleResumeCheck);
    window.addEventListener('focus', handleResumeCheck);
    window.addEventListener('pageshow', handleResumeCheck);
    window.addEventListener('storage', handleStorage);

    const intervalId = window.setInterval(() => {
      controller.evaluate();
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
      for (const eventName of GENUINE_USER_ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, handleUserEvent, { capture: true });
      }
      document.removeEventListener('visibilitychange', handleResumeCheck);
      window.removeEventListener('focus', handleResumeCheck);
      window.removeEventListener('pageshow', handleResumeCheck);
      window.removeEventListener('storage', handleStorage);
      controller.destroy();
      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
    };
  }, [enabled, userScope, config]);

  const stayLoggedIn = useCallback(() => {
    controllerRef.current?.stayLoggedIn();
  }, []);

  const logoutNow = useCallback(() => {
    controllerRef.current?.logoutNow();
  }, []);

  const notifyUserActivity = useCallback((force = false) => {
    controllerRef.current?.recordUserActivity(force);
  }, []);

  return {
    snapshot,
    stayLoggedIn,
    logoutNow,
    notifyUserActivity,
  };
}
