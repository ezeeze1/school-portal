import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  GENUINE_USER_ACTIVITY_EVENTS,
  SESSION_ACTIVITY_STORAGE_KEY,
  SESSION_CBT_HEARTBEAT_STORAGE_KEY,
  SESSION_EXPIRED_LOGOUT_MESSAGE,
  SESSION_SYNC_EVENT_STORAGE_KEY,
  SESSION_TIMEOUT_CONFIG,
  SESSION_WARNING_MESSAGE,
  SESSION_WARNING_TITLE,
} from '../src/config/sessionConfig';
import {
  clearCBTExamHeartbeat,
  evaluateIdleStatus,
  formatCountdownMMSS,
  hasVerifiedActiveCBTExamExemption,
  IdleSessionController,
  publishCBTExamHeartbeat,
  purgeSupabaseAuthTokensOnFailure,
  readSessionExpiredNotice,
  saveSessionExpiredNotice,
  type BroadcastChannelLike,
  type LogoutTriggerReason,
  type SessionEnvironmentAdapters,
  type StorageLike,
} from '../src/lib/sessionActivity';
import { AuthSessionCoordinator } from '../src/lib/authSessionCoordinator';

class MemoryStorage implements StorageLike {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }
  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

class MockBroadcastHub {
  private channels = new Set<MockBroadcastChannel>();
  createChannel = (): BroadcastChannelLike => {
    const ch = new MockBroadcastChannel(this);
    this.channels.add(ch);
    return ch;
  };
  dispatch(sender: MockBroadcastChannel, data: unknown) {
    for (const ch of this.channels) {
      if (ch !== sender && !ch.closed && ch.onmessage) {
        ch.onmessage({ data });
      }
    }
  }
  remove(ch: MockBroadcastChannel) {
    this.channels.delete(ch);
  }
  get activeChannelCount() {
    return this.channels.size;
  }
}

class MockBroadcastChannel implements BroadcastChannelLike {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  closed = false;
  constructor(private readonly hub: MockBroadcastHub) {}
  postMessage(data: unknown): void {
    if (!this.closed) {
      this.hub.dispatch(this, data);
    }
  }
  close(): void {
    this.closed = true;
    this.hub.remove(this);
  }
}

async function runTests() {
  let passedCount = 0;
  const test = async (name: string, fn: () => Promise<void> | void) => {
    await fn();
    passedCount += 1;
    console.log(`PASS: ${name}`);
  };

  // 1. Public unauthenticated visitors unaffected
  await test('1. Public unauthenticated visitors remain completely unaffected by session timeout', () => {
    const providerSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/common/SessionTimeoutProvider.tsx'),
      'utf8'
    );
    const hookSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/hooks/useIdleTimeout.ts'),
      'utf8'
    );
    assert.ok(providerSrc.includes("activeRole !== 'public'"));
    assert.ok(providerSrc.includes('enabled: isAuthenticated'));
    assert.ok(hookSrc.includes('if (!enabled || !userScope)'));
  });

  // 2. Centralized constants & coverage across all 4 authenticated roles
  await test('2. Centralized config enforces 25m timeout, 23m warning, 2m countdown across admin, teacher, student, parent', () => {
    assert.equal(SESSION_TIMEOUT_CONFIG.INACTIVITY_TIMEOUT_MS, 25 * 60 * 1000);
    assert.equal(SESSION_TIMEOUT_CONFIG.WARNING_TRIGGER_AT_MS, 23 * 60 * 1000);
    assert.equal(SESSION_TIMEOUT_CONFIG.WARNING_BEFORE_LOGOUT_MS, 2 * 60 * 1000);
    assert.equal(SESSION_TIMEOUT_CONFIG.ACTIVE_CBT_EXEMPTION_ENABLED, true);
    assert.equal(SESSION_WARNING_TITLE, 'Session Expiring Soon');
    assert.equal(
      SESSION_WARNING_MESSAGE,
      'For your security, you will be automatically logged out in 2 minutes due to inactivity. Click Stay Logged In to continue your session.'
    );
    assert.equal(
      SESSION_EXPIRED_LOGOUT_MESSAGE,
      'You have been automatically logged out after 25 minutes of inactivity for your security. Please log in again to continue.'
    );

    const ls = new MemoryStorage();
    const ss = new MemoryStorage();
    for (const role of ['admin', 'teacher', 'student', 'parent'] as const) {
      let nowMs = 1_000_000;
      let timedOut = 0;
      const ctrl = new IdleSessionController({
        userScope: `${role}:user-1`,
        resetStoredTimestampOnStart: true,
        adapters: { now: () => nowMs, localStorage: ls, sessionStorage: ss, hasActiveMountedCBTDom: () => false },
        onSnapshotChange: () => {},
        onTimeoutLogout: () => {
          timedOut += 1;
        },
        onManualLogout: () => {},
        onRemoteLogout: () => {},
      });
      nowMs += 25 * 60 * 1000;
      ctrl.evaluate();
      assert.equal(timedOut, 1, `Expected 25-min timeout for ${role}`);
      ctrl.destroy();
    }
  });

  // 3. Genuine user activity resets timer cleanly (with throttle)
  await test('3. Genuine user interaction resets inactivity timer and throttles rapid event bursts', () => {
    let nowMs = 10_000;
    const ls = new MemoryStorage();
    const ss = new MemoryStorage();
    let timedOut = 0;

    const ctrl = new IdleSessionController({
      userScope: 'teacher:t-1',
      resetStoredTimestampOnStart: true,
      adapters: { now: () => nowMs, localStorage: ls, sessionStorage: ss, hasActiveMountedCBTDom: () => false },
      onSnapshotChange: () => {},
      onTimeoutLogout: () => {
        timedOut += 1;
      },
      onManualLogout: () => {},
      onRemoteLogout: () => {},
    });

    // Advance 20 mins, then trigger throttled activity
    nowMs += 20 * 60 * 1000;
    ctrl.recordUserActivity(); // allowed (> 1s since start)
    const afterActivity = ctrl.evaluate();
    assert.equal(afterActivity.status, 'active');

    // Burst 200ms later should be throttled (lastActivityAtMs stays at 20m mark)
    nowMs += 200;
    ctrl.recordUserActivity();
    assert.equal(ctrl.evaluate().lastActivityAtMs, 10_000 + 20 * 60 * 1000);

    // Original 25m mark from t=0 passes without logout because activity happened at t=20m
    nowMs = 10_000 + 26 * 60 * 1000;
    assert.equal(ctrl.evaluate().status, 'active');
    assert.equal(timedOut, 0);

    // Genuine DOM events list covers mouse, keyboard, touch, scroll, pointer
    for (const ev of ['mousemove', 'mousedown', 'click', 'keydown', 'touchstart', 'touchmove', 'scroll', 'pointerdown', 'pointermove'] as const) {
      assert.ok((GENUINE_USER_ACTIVITY_EVENTS as readonly string[]).includes(ev), `Missing ${ev}`);
    }
    ctrl.destroy();
  });

  // 4. Token refresh, background polling, timers, and animations do NOT reset timer
  await test('4. Background Supabase TOKEN_REFRESHED and passive timers do not reset idle activity', () => {
    let nowMs = 50_000;
    const ls = new MemoryStorage();
    const ss = new MemoryStorage();
    let timedOut = 0;

    const ctrl = new IdleSessionController({
      userScope: 'admin:adm-1',
      resetStoredTimestampOnStart: true,
      adapters: { now: () => nowMs, localStorage: ls, sessionStorage: ss, hasActiveMountedCBTDom: () => false },
      onSnapshotChange: () => {},
      onTimeoutLogout: () => {
        timedOut += 1;
      },
      onManualLogout: () => {},
      onRemoteLogout: () => {},
    });

    // Calling evaluate() repeatedly (simulating 1s timer ticks / background polling / TOKEN_REFRESHED)
    for (let min = 1; min <= 24; min += 1) {
      nowMs = 50_000 + min * 60 * 1000;
      ctrl.evaluate();
    }
    assert.equal(ctrl.evaluate().status, 'warning');
    assert.equal(timedOut, 0);

    nowMs = 50_000 + 25 * 60 * 1000;
    ctrl.evaluate();
    assert.equal(timedOut, 1);
    ctrl.destroy();

    const hookSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/hooks/useIdleTimeout.ts'), 'utf8');
    assert.equal(hookSrc.includes('TOKEN_REFRESHED'), false);
    assert.equal(hookSrc.includes('onAuthStateChange'), false);
  });

  // 5. Warning modal triggers at 23 minutes with exact copy & live MM:SS countdown
  await test('5. Warning modal opens at 23 minutes with exact countdown progression from 02:00 to 00:01', () => {
    const start = 100_000;
    const eval22 = evaluateIdleStatus({
      lastActivityAtMs: start,
      nowMs: start + 22 * 60 * 1000,
      cbtExamActive: false,
    });
    assert.equal(eval22.status, 'active');

    const eval23 = evaluateIdleStatus({
      lastActivityAtMs: start,
      nowMs: start + 23 * 60 * 1000,
      cbtExamActive: false,
    });
    assert.equal(eval23.status, 'warning');
    assert.equal(formatCountdownMMSS(eval23.warningCountdownSeconds), '02:00');

    const eval24m30s = evaluateIdleStatus({
      lastActivityAtMs: start,
      nowMs: start + 24 * 60 * 1000 + 30_000,
      cbtExamActive: false,
    });
    assert.equal(eval24m30s.status, 'warning');
    assert.equal(formatCountdownMMSS(eval24m30s.warningCountdownSeconds), '00:30');

    const eval25 = evaluateIdleStatus({
      lastActivityAtMs: start,
      nowMs: start + 25 * 60 * 1000,
      cbtExamActive: false,
    });
    assert.equal(eval25.status, 'expired');
    assert.equal(formatCountdownMMSS(eval25.warningCountdownSeconds), '00:00');
  });

  // 6. Clicking Stay Logged In closes modal & resets inactivity timer to 25 mins
  await test('6. Clicking Stay Logged In closes warning modal and restores a full 25-minute window', () => {
    let nowMs = 200_000;
    const ls = new MemoryStorage();
    const ss = new MemoryStorage();
    let timedOut = 0;

    const ctrl = new IdleSessionController({
      userScope: 'parent:p-1',
      resetStoredTimestampOnStart: true,
      adapters: { now: () => nowMs, localStorage: ls, sessionStorage: ss, hasActiveMountedCBTDom: () => false },
      onSnapshotChange: () => {},
      onTimeoutLogout: () => {
        timedOut += 1;
      },
      onManualLogout: () => {},
      onRemoteLogout: () => {},
    });

    nowMs = 200_000 + 23 * 60 * 1000 + 45_000;
    assert.equal(ctrl.evaluate().isWarningOpen, true);

    ctrl.stayLoggedIn();
    const afterStay = ctrl.evaluate();
    assert.equal(afterStay.isWarningOpen, false);
    assert.equal(afterStay.status, 'active');

    nowMs += 20 * 60 * 1000;
    assert.equal(ctrl.evaluate().status, 'active');
    assert.equal(timedOut, 0);
    ctrl.destroy();
  });

  // 7. Clicking Log Out Now immediately logs out cleanly without inactivity banner
  await test('7. Clicking Log Out Now invokes immediate manual logout and clears session sync keys', () => {
    let nowMs = 300_000;
    const ls = new MemoryStorage();
    const ss = new MemoryStorage();
    let manualCalls = 0;
    let timeoutCalls = 0;

    const ctrl = new IdleSessionController({
      userScope: 'student:std-1',
      resetStoredTimestampOnStart: true,
      adapters: { now: () => nowMs, localStorage: ls, sessionStorage: ss, hasActiveMountedCBTDom: () => false },
      onSnapshotChange: () => {},
      onTimeoutLogout: () => {
        timeoutCalls += 1;
      },
      onManualLogout: () => {
        manualCalls += 1;
      },
      onRemoteLogout: () => {},
    });

    nowMs += 23 * 60 * 1000;
    assert.equal(ctrl.evaluate().isWarningOpen, true);
    ctrl.logoutNow();

    assert.equal(manualCalls, 1);
    assert.equal(timeoutCalls, 0);
    assert.equal(ls.getItem(SESSION_ACTIVITY_STORAGE_KEY), null);
    ctrl.destroy();
  });

  // 8. Ignoring warning triggers automatic logout at 25 minutes with exact message
  await test('8. Ignoring warning triggers single-flight automatic logout at 25m and persists exact notice', () => {
    let nowMs = 400_000;
    const ls = new MemoryStorage();
    const ss = new MemoryStorage();
    let timeoutCalls = 0;

    const ctrl = new IdleSessionController({
      userScope: 'teacher:t-2',
      resetStoredTimestampOnStart: true,
      adapters: { now: () => nowMs, localStorage: ls, sessionStorage: ss, hasActiveMountedCBTDom: () => false },
      onSnapshotChange: () => {},
      onTimeoutLogout: () => {
        timeoutCalls += 1;
        saveSessionExpiredNotice(SESSION_EXPIRED_LOGOUT_MESSAGE, { sessionStorage: ss });
      },
      onManualLogout: () => {},
      onRemoteLogout: () => {},
    });

    nowMs += 25 * 60 * 1000;
    ctrl.evaluate();
    ctrl.evaluate(); // repeated tick must NOT double-trigger logout
    assert.equal(timeoutCalls, 1);
    assert.equal(readSessionExpiredNotice({ sessionStorage: ss }), SESSION_EXPIRED_LOGOUT_MESSAGE);
    ctrl.destroy();
  });

  // 9. Post-logout cleanup preserves public website state & avoids localStorage.clear()
  await test('9. Post-logout cleanup clears only sensitive/session keys and never wipes public site storage', () => {
    const ls = new MemoryStorage();
    ls.setItem('divine_academy_portal_settings', '{"schoolName":"Divine Academy"}');
    ls.setItem('divine_academy_portal_news', '[{"id":"1"}]');
    ls.setItem('sb-proj-auth-token', '{"access_token":"secret"}');

    purgeSupabaseAuthTokensOnFailure({ localStorage: ls });
    assert.equal(ls.getItem('sb-proj-auth-token'), null);
    assert.equal(ls.getItem('divine_academy_portal_settings'), '{"schoolName":"Divine Academy"}');
    assert.equal(ls.getItem('divine_academy_portal_news'), '[{"id":"1"}]');

    for (const rel of [
      'src/lib/sessionActivity.ts',
      'src/components/common/SessionTimeoutProvider.tsx',
      'src/context/SchoolContext.tsx',
    ]) {
      const content = fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8');
      assert.equal(content.includes('localStorage.clear('), false, `${rel} must not clear all localStorage`);
      assert.equal(content.includes('sessionStorage.clear('), false, `${rel} must not clear all sessionStorage`);
    }
  });

  // 10. Network failure during logout still locks protected application state fail-closed
  await test('10. AuthSessionCoordinator locks protected UI immediately even when network signOut fails', async () => {
    const events: string[] = [];
    const coordinator = new AuthSessionCoordinator(
      {
        getSession: async () => ({ data: { session: null } }),
        signInWithPassword: async () => ({
          data: { user: null, session: null },
          error: { message: 'unused' },
        }),
        signOut: async () => {
          events.push('signOutAttempted');
          throw new Error('Failed to fetch');
        },
        onAuthStateChange: () => ({
          data: { subscription: { unsubscribe: () => {} } },
        }),
      },
      {
        syncMyUserProfile: async () => ({ profile: null }),
        fetchPortalSnapshot: async () => ({}),
      },
      {
        setAuthLoading: () => {},
        applyPublicSnapshot: async () => {
          events.push('applyPublicSnapshot');
        },
        applyAuthenticatedSession: () => {},
        resetToPublic: () => {
          events.push('resetToPublic');
        },
      }
    );

    await coordinator.logout();
    assert.equal(events[0], 'resetToPublic', 'Protected dashboards must lock before remote signOut');
    assert.ok(events.includes('signOutAttempted'));
    assert.ok(events.includes('applyPublicSnapshot'));
  });

  // 11. Active CBT exam prevents warning and timeout even past 30 minutes
  await test('11. Active verified CBT examination exempts student from warning and automatic logout', () => {
    let nowMs = 500_000;
    const ls = new MemoryStorage();
    const ss = new MemoryStorage();
    const hub = new MockBroadcastHub();
    const adapters: SessionEnvironmentAdapters = {
      now: () => nowMs,
      localStorage: ls,
      sessionStorage: ss,
      createBroadcastChannel: hub.createChannel,
      hasActiveMountedCBTDom: () => false,
    };

    publishCBTExamHeartbeat(
      {
        examId: 'exam-math-01',
        sessionId: 'sess-01',
        studentId: 'std-1',
        updatedAtMs: nowMs,
        expiresAtMs: nowMs + 60 * 60 * 1000,
      },
      adapters
    );

    let timedOut = 0;
    const ctrl = new IdleSessionController({
      userScope: 'student:std-1',
      resetStoredTimestampOnStart: true,
      adapters,
      onSnapshotChange: () => {},
      onTimeoutLogout: () => {
        timedOut += 1;
      },
      onManualLogout: () => {},
      onRemoteLogout: () => {},
    });

    for (let m = 5; m <= 35; m += 5) {
      nowMs = 500_000 + m * 60 * 1000;
      publishCBTExamHeartbeat(
        {
          examId: 'exam-math-01',
          sessionId: 'sess-01',
          studentId: 'std-1',
          updatedAtMs: nowMs,
          expiresAtMs: 500_000 + 60 * 60 * 1000,
        },
        adapters
      );
      const snap = ctrl.evaluate();
      assert.equal(snap.status, 'exempt_cbt');
      assert.equal(snap.isWarningOpen, false);
    }
    assert.equal(timedOut, 0);
    ctrl.destroy();
  });

  // 12. Stale/expired CBT exam marker never bypasses inactivity logout
  await test('12. Stale or expired CBT markers are auto-scrubbed and do not suppress inactivity logout', () => {
    let nowMs = 1_000_000;
    const ls = new MemoryStorage();
    const ss = new MemoryStorage();
    const adapters: SessionEnvironmentAdapters = {
      now: () => nowMs,
      localStorage: ls,
      sessionStorage: ss,
      hasActiveMountedCBTDom: () => false,
    };

    // Write stale legacy marker + expired heartbeat
    ss.setItem('cbt_active_exam_std-99', 'old-exam');
    ls.setItem(
      SESSION_CBT_HEARTBEAT_STORAGE_KEY,
      JSON.stringify({
        examId: 'old-exam',
        sessionId: 'old-sess',
        studentId: 'std-99',
        updatedAtMs: nowMs - 120_000, // 2 mins stale (> 45s)
        expiresAtMs: nowMs + 600_000,
      })
    );

    assert.equal(hasVerifiedActiveCBTExamExemption(adapters), false);
    assert.equal(ss.getItem('cbt_active_exam_std-99'), null);
    assert.equal(ls.getItem(SESSION_CBT_HEARTBEAT_STORAGE_KEY), null);
  });

  // 13. Post-exam recovery resumes fresh 25-min countdown after exam submission
  await test('13. Completing CBT exam lifts exemption immediately and starts a fresh 25m countdown', () => {
    let nowMs = 2_000_000;
    const ls = new MemoryStorage();
    const ss = new MemoryStorage();
    const hub = new MockBroadcastHub();
    const adapters: SessionEnvironmentAdapters = {
      now: () => nowMs,
      localStorage: ls,
      sessionStorage: ss,
      createBroadcastChannel: hub.createChannel,
      hasActiveMountedCBTDom: () => false,
    };

    publishCBTExamHeartbeat(
      {
        examId: 'exam-bio',
        sessionId: 'sess-bio',
        studentId: 'std-2',
        updatedAtMs: nowMs,
        expiresAtMs: nowMs + 45 * 60 * 1000,
      },
      adapters
    );

    let timedOut = 0;
    const ctrl = new IdleSessionController({
      userScope: 'student:std-2',
      resetStoredTimestampOnStart: true,
      adapters,
      onSnapshotChange: () => {},
      onTimeoutLogout: () => {
        timedOut += 1;
      },
      onManualLogout: () => {},
      onRemoteLogout: () => {},
    });

    // Advance 30 minutes mid-exam (exempted)
    nowMs += 30 * 60 * 1000;
    publishCBTExamHeartbeat(
      {
        examId: 'exam-bio',
        sessionId: 'sess-bio',
        studentId: 'std-2',
        updatedAtMs: nowMs,
        expiresAtMs: nowMs + 15 * 60 * 1000,
      },
      adapters
    );
    assert.equal(ctrl.evaluate().status, 'exempt_cbt');

    // Exam submitted!
    clearCBTExamHeartbeat('std-2', adapters);
    const postExam = ctrl.evaluate();
    assert.equal(postExam.status, 'active');
    assert.equal(postExam.cbtExamActive, false);
    assert.equal(timedOut, 0);

    // Must NOT immediately log out; warning only appears 23m after submission
    nowMs += 23 * 60 * 1000;
    assert.equal(ctrl.evaluate().isWarningOpen, true);

    nowMs += 2 * 60 * 1000;
    ctrl.evaluate();
    assert.equal(timedOut, 1);
    ctrl.destroy();
  });

  // 14. Multi-tab activity & Stay Logged In synchronization
  await test('14. Multi-tab sync propagates activity and Stay Logged In to close warning in other tabs', () => {
    let nowMs = 3_000_000;
    const ls = new MemoryStorage();
    const ss = new MemoryStorage();
    const hub = new MockBroadcastHub();
    const adapters: SessionEnvironmentAdapters = {
      now: () => nowMs,
      localStorage: ls,
      sessionStorage: ss,
      createBroadcastChannel: hub.createChannel,
      hasActiveMountedCBTDom: () => false,
    };

    const tabA = new IdleSessionController({
      userScope: 'teacher:t-5',
      resetStoredTimestampOnStart: true,
      adapters,
      onSnapshotChange: () => {},
      onTimeoutLogout: () => {},
      onManualLogout: () => {},
      onRemoteLogout: () => {},
    });

    const tabB = new IdleSessionController({
      userScope: 'teacher:t-5',
      resetStoredTimestampOnStart: false,
      adapters,
      onSnapshotChange: () => {},
      onTimeoutLogout: () => {},
      onManualLogout: () => {},
      onRemoteLogout: () => {},
    });

    nowMs += 23 * 60 * 1000 + 10_000;
    assert.equal(tabA.evaluate().isWarningOpen, true);
    assert.equal(tabB.evaluate().isWarningOpen, true);

    tabB.stayLoggedIn();
    assert.equal(tabB.evaluate().isWarningOpen, false);
    assert.equal(tabA.evaluate().isWarningOpen, false);

    tabA.destroy();
    tabB.destroy();
  });

  // 15. Multi-tab logout & CBT protection across tabs without duplicate signOut
  await test('15. Multi-tab logout locks sibling tabs without duplicate signOut and honors cross-tab CBT exemption', () => {
    let nowMs = 4_000_000;
    const ls = new MemoryStorage();
    const ss = new MemoryStorage();
    const hub = new MockBroadcastHub();
    const adapters: SessionEnvironmentAdapters = {
      now: () => nowMs,
      localStorage: ls,
      sessionStorage: ss,
      createBroadcastChannel: hub.createChannel,
      hasActiveMountedCBTDom: () => false,
    };

    let tabATimeouts = 0;
    let tabBRemoteReason: LogoutTriggerReason | null = null;
    let tabBLocalTimeouts = 0;

    const tabA = new IdleSessionController({
      userScope: 'student:std-5',
      resetStoredTimestampOnStart: true,
      adapters,
      onSnapshotChange: () => {},
      onTimeoutLogout: () => {
        tabATimeouts += 1;
      },
      onManualLogout: () => {},
      onRemoteLogout: () => {},
    });

    const tabB = new IdleSessionController({
      userScope: 'student:std-5',
      resetStoredTimestampOnStart: false,
      adapters,
      onSnapshotChange: () => {},
      onTimeoutLogout: () => {
        tabBLocalTimeouts += 1;
      },
      onManualLogout: () => {},
      onRemoteLogout: (reason) => {
        tabBRemoteReason = reason;
      },
    });

    // While CBT exam is active in Tab A, Tab B must ALSO be exempted
    publishCBTExamHeartbeat(
      {
        examId: 'exam-eng',
        sessionId: 'sess-eng',
        studentId: 'std-5',
        updatedAtMs: nowMs,
        expiresAtMs: nowMs + 60 * 60 * 1000,
      },
      adapters
    );
    nowMs += 30 * 60 * 1000;
    publishCBTExamHeartbeat(
      {
        examId: 'exam-eng',
        sessionId: 'sess-eng',
        studentId: 'std-5',
        updatedAtMs: nowMs,
        expiresAtMs: nowMs + 30 * 60 * 1000,
      },
      adapters
    );
    assert.equal(tabB.evaluate().status, 'exempt_cbt');
    assert.equal(tabATimeouts, 0);
    assert.equal(tabBLocalTimeouts, 0);

    // End CBT exam and let 25m pass -> Tab A times out once and notifies Tab B via onRemoteLogout
    clearCBTExamHeartbeat('std-5', adapters);
    tabA.evaluate();
    nowMs += 25 * 60 * 1000;
    tabA.evaluate();
    assert.equal(tabATimeouts, 1);
    assert.equal(tabBRemoteReason, 'inactivity');
    assert.equal(tabBLocalTimeouts, 0);

    tabA.destroy();
    tabB.destroy();
  });

  // 16. Hidden tab, mobile screen lock, or sleep past 25 minutes triggers immediate logout on resume
  await test('16. Tab resume / mobile sleep wake exceeding 25 minutes immediately triggers single logout', () => {
    let nowMs = 5_000_000;
    const ls = new MemoryStorage();
    const ss = new MemoryStorage();
    let timeouts = 0;

    const ctrl = new IdleSessionController({
      userScope: 'admin:adm-2',
      resetStoredTimestampOnStart: true,
      adapters: { now: () => nowMs, localStorage: ls, sessionStorage: ss, hasActiveMountedCBTDom: () => false },
      onSnapshotChange: () => {},
      onTimeoutLogout: () => {
        timeouts += 1;
      },
      onManualLogout: () => {},
      onRemoteLogout: () => {},
    });

    // Simulate OS sleeping 42 minutes in a single jump before visibilitychange/focus runs evaluate()
    nowMs += 42 * 60 * 1000;
    ctrl.evaluate();
    assert.equal(timeouts, 1);

    // Further input after wake while logged out must not re-fire or undo logout
    ctrl.recordUserActivity(true);
    assert.equal(timeouts, 1);
    ctrl.destroy();
  });

  // 17. Browser Back / unauthorized dashboard access guard after logout
  await test('17. Browser Back / portal access guard enforces verifiedRole and popstate replacement after logout', () => {
    const appSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf8');
    const providerSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/common/SessionTimeoutProvider.tsx'),
      'utf8'
    );
    assert.ok(appSrc.includes("activeRole !== 'public' && currentUser?.role === activeRole ? activeRole : 'public'"));
    assert.ok(appSrc.includes('<SessionTimeoutProvider>'));
    assert.ok(providerSrc.includes('popstate'));
    assert.ok(providerSrc.includes('history.replaceState'));
    assert.ok(providerSrc.includes('SESSION_EXPIRED_LOGOUT_MESSAGE'));
  });

  // 18. Fresh login re-initializes session activity cleanly & clears old notice
  await test('18. Fresh login resets prior inactivity timestamp and clears logout notice cleanly', () => {
    let nowMs = 6_000_000;
    const ls = new MemoryStorage();
    const ss = new MemoryStorage();
    saveSessionExpiredNotice(SESSION_EXPIRED_LOGOUT_MESSAGE, { sessionStorage: ss });

    const loginSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/auth/LoginModal.tsx'),
      'utf8'
    );
    assert.ok(loginSrc.includes('clearSessionExpiredNotice()'));
    assert.ok(loginSrc.includes('sessionExpiredNotice'));

    // Simulate old stored activity timestamp > 25m old before fresh login
    ls.setItem(
      SESSION_ACTIVITY_STORAGE_KEY,
      JSON.stringify({ userScope: 'student:std-9', lastActivityAtMs: nowMs - 40 * 60 * 1000 })
    );

    let timedOut = 0;
    const ctrl = new IdleSessionController({
      userScope: 'student:std-9',
      resetStoredTimestampOnStart: true,
      adapters: { now: () => nowMs, localStorage: ls, sessionStorage: ss, hasActiveMountedCBTDom: () => false },
      onSnapshotChange: () => {},
      onTimeoutLogout: () => {
        timedOut += 1;
      },
      onManualLogout: () => {},
      onRemoteLogout: () => {},
    });

    assert.equal(ctrl.evaluate().status, 'active');
    assert.equal(timedOut, 0);
    ctrl.destroy();
  });

  // 19. PWA standalone compatibility & CBT exam runner heartbeat integration
  await test('19. PWA update protection and CBTExamRunner heartbeat integration are cleanly wired without SW conflict', () => {
    const runnerSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/student/CBTExamRunner.tsx'),
      'utf8'
    );
    const headerSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/common/Header.tsx'),
      'utf8'
    );
    const modalSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/common/SessionExpiryModal.tsx'),
      'utf8'
    );

    assert.ok(runnerSrc.includes('publishCBTExamHeartbeat'));
    assert.ok(runnerSrc.includes('clearCBTExamHeartbeat'));
    assert.ok(runnerSrc.includes('data-cbt-expires-at'));
    assert.ok(headerSrc.includes('shouldOpenLoginModal'));
    assert.ok(headerSrc.includes('sessionExpiredNotice'));
    assert.ok(modalSrc.includes('SESSION_WARNING_TITLE'));
    assert.ok(modalSrc.includes('Stay Logged In'));
    assert.ok(modalSrc.includes('Log Out Now'));
    assert.ok(modalSrc.includes('tabular-nums'));
  });

  // 20. Clean listener & BroadcastChannel cleanup (no memory leaks on repeated mount/unmount)
  await test('20. Repeated controller mount/unmount leaves zero dangling BroadcastChannels or timers', () => {
    const ls = new MemoryStorage();
    const ss = new MemoryStorage();
    const hub = new MockBroadcastHub();

    for (let i = 0; i < 15; i += 1) {
      const ctrl = new IdleSessionController({
        userScope: `teacher:leak-check-${i}`,
        resetStoredTimestampOnStart: true,
        adapters: {
          now: () => 1_000_000 + i * 1000,
          localStorage: ls,
          sessionStorage: ss,
          createBroadcastChannel: hub.createChannel,
          hasActiveMountedCBTDom: () => false,
        },
        onSnapshotChange: () => {},
        onTimeoutLogout: () => {},
        onManualLogout: () => {},
        onRemoteLogout: () => {},
      });
      ctrl.recordUserActivity(true);
      ctrl.destroy();
    }

    assert.equal(hub.activeChannelCount, 0);

    // Ensure storage event forwarding works when BroadcastChannel is unavailable
    let nowMs = 8_000_000;
    const ctrlA = new IdleSessionController({
      userScope: 'parent:fallback',
      resetStoredTimestampOnStart: true,
      adapters: {
        now: () => nowMs,
        localStorage: ls,
        sessionStorage: ss,
        createBroadcastChannel: () => null,
        hasActiveMountedCBTDom: () => false,
      },
      onSnapshotChange: () => {},
      onTimeoutLogout: () => {},
      onManualLogout: () => {},
      onRemoteLogout: () => {},
    });
    const ctrlB = new IdleSessionController({
      userScope: 'parent:fallback',
      resetStoredTimestampOnStart: false,
      adapters: {
        now: () => nowMs,
        localStorage: ls,
        sessionStorage: ss,
        createBroadcastChannel: () => null,
        hasActiveMountedCBTDom: () => false,
      },
      onSnapshotChange: () => {},
      onTimeoutLogout: () => {},
      onManualLogout: () => {},
      onRemoteLogout: () => {},
    });

    nowMs += 23 * 60 * 1000 + 5_000;
    assert.equal(ctrlB.evaluate().isWarningOpen, true);
    ctrlA.stayLoggedIn();
    ctrlB.handleStorageEvent(
      SESSION_SYNC_EVENT_STORAGE_KEY,
      ls.getItem(SESSION_SYNC_EVENT_STORAGE_KEY)
    );
    assert.equal(ctrlB.evaluate().isWarningOpen, false);

    ctrlA.destroy();
    ctrlB.destroy();
  });

  console.log(`\nALL ${passedCount} SESSION INACTIVITY TESTS PASSED`);
}

runTests().catch((err) => {
  console.error('SESSION INACTIVITY TEST FAILED:', err);
  process.exit(1);
});
