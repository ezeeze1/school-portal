import {
  SESSION_ACTIVITY_STORAGE_KEY,
  SESSION_CBT_HEARTBEAT_STORAGE_KEY,
  SESSION_EXPIRED_NOTICE_STORAGE_KEY,
  SESSION_SYNC_CHANNEL_NAME,
  SESSION_SYNC_EVENT_STORAGE_KEY,
  SESSION_TIMEOUT_CONFIG,
  type SessionTimeoutConfig,
} from '../config/sessionConfig';
import { CBT_ACTIVE_ATTR_SELECTOR, CBT_ACTIVE_STORAGE_PREFIX } from './pwaProtection';

export type IdleStatusKind = 'exempt_cbt' | 'active' | 'warning' | 'expired';

export type LogoutTriggerReason = 'inactivity' | 'manual';

export interface IdleEvaluation {
  status: IdleStatusKind;
  elapsedMs: number;
  remainingMs: number;
  warningCountdownMs: number;
  warningCountdownSeconds: number;
}

export interface CBTExamHeartbeatRecord {
  examId: string;
  sessionId: string;
  studentId: string;
  updatedAtMs: number;
  expiresAtMs: number;
}

export type SessionSyncMessage =
  | {
      type: 'ACTIVITY_UPDATE';
      userScope: string;
      lastActivityAtMs: number;
      tabId: string;
      sentAtMs: number;
    }
  | {
      type: 'STAY_LOGGED_IN';
      userScope: string;
      lastActivityAtMs: number;
      tabId: string;
      sentAtMs: number;
    }
  | {
      type: 'LOGOUT_TRIGGERED';
      userScope: string;
      reason: LogoutTriggerReason;
      tabId: string;
      sentAtMs: number;
    }
  | {
      type: 'CBT_HEARTBEAT';
      heartbeat: CBTExamHeartbeatRecord;
      tabId: string;
      sentAtMs: number;
    }
  | {
      type: 'CBT_ENDED';
      studentId?: string;
      tabId: string;
      sentAtMs: number;
    };

export interface StorageLike {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface BroadcastChannelLike {
  onmessage: ((event: { data: unknown }) => void) | null;
  postMessage(data: unknown): void;
  close(): void;
}

export interface SessionEnvironmentAdapters {
  now?: () => number;
  localStorage?: StorageLike | null;
  sessionStorage?: StorageLike | null;
  createBroadcastChannel?: (name: string) => BroadcastChannelLike | null;
  hasActiveMountedCBTDom?: (nowMs: number) => boolean;
}

function getDefaultLocalStorage(): StorageLike | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

function getDefaultSessionStorage(): StorageLike | null {
  try {
    return typeof window !== 'undefined' && window.sessionStorage ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

function getDefaultBroadcastChannel(name: string): BroadcastChannelLike | null {
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      return new BroadcastChannel(name);
    }
  } catch {
    // Ignore restricted BroadcastChannel contexts
  }
  return null;
}

function defaultHasActiveMountedCBTDom(nowMs: number): boolean {
  try {
    if (typeof document === 'undefined') return false;
    const el = document.querySelector(CBT_ACTIVE_ATTR_SELECTOR);
    if (!el) return false;

    const rawExpires = el.getAttribute('data-cbt-expires-at');
    if (rawExpires) {
      const expiresAtMs = Number(rawExpires);
      if (Number.isFinite(expiresAtMs) && expiresAtMs <= nowMs) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

export function formatCountdownMMSS(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function evaluateIdleStatus(params: {
  lastActivityAtMs: number;
  nowMs: number;
  cbtExamActive: boolean;
  config?: SessionTimeoutConfig;
}): IdleEvaluation {
  const config = params.config ?? SESSION_TIMEOUT_CONFIG;
  if (params.cbtExamActive && config.ACTIVE_CBT_EXEMPTION_ENABLED) {
    return {
      status: 'exempt_cbt',
      elapsedMs: 0,
      remainingMs: config.INACTIVITY_TIMEOUT_MS,
      warningCountdownMs: config.WARNING_BEFORE_LOGOUT_MS,
      warningCountdownSeconds: Math.ceil(config.WARNING_BEFORE_LOGOUT_MS / 1000),
    };
  }

  const elapsedMs = Math.max(0, params.nowMs - params.lastActivityAtMs);
  const remainingMs = Math.max(0, config.INACTIVITY_TIMEOUT_MS - elapsedMs);
  const warningCountdownMs = Math.min(config.WARNING_BEFORE_LOGOUT_MS, remainingMs);
  const warningCountdownSeconds = Math.max(0, Math.ceil(warningCountdownMs / 1000));

  if (elapsedMs >= config.INACTIVITY_TIMEOUT_MS) {
    return {
      status: 'expired',
      elapsedMs,
      remainingMs: 0,
      warningCountdownMs: 0,
      warningCountdownSeconds: 0,
    };
  }

  if (elapsedMs >= config.WARNING_TRIGGER_AT_MS) {
    return {
      status: 'warning',
      elapsedMs,
      remainingMs,
      warningCountdownMs,
      warningCountdownSeconds,
    };
  }

  return {
    status: 'active',
    elapsedMs,
    remainingMs,
    warningCountdownMs: config.WARNING_BEFORE_LOGOUT_MS,
    warningCountdownSeconds: Math.ceil(config.WARNING_BEFORE_LOGOUT_MS / 1000),
  };
}

export function isValidCBTHeartbeatRecord(
  raw: unknown,
  nowMs: number,
  config: SessionTimeoutConfig = SESSION_TIMEOUT_CONFIG
): raw is CBTExamHeartbeatRecord {
  if (!raw || typeof raw !== 'object') return false;
  const candidate = raw as Partial<CBTExamHeartbeatRecord>;
  if (
    typeof candidate.examId !== 'string' ||
    !candidate.examId ||
    typeof candidate.sessionId !== 'string' ||
    !candidate.sessionId ||
    typeof candidate.studentId !== 'string' ||
    !candidate.studentId
  ) {
    return false;
  }
  if (
    typeof candidate.updatedAtMs !== 'number' ||
    !Number.isFinite(candidate.updatedAtMs) ||
    typeof candidate.expiresAtMs !== 'number' ||
    !Number.isFinite(candidate.expiresAtMs)
  ) {
    return false;
  }
  if (candidate.expiresAtMs <= nowMs) {
    return false;
  }
  if (nowMs - candidate.updatedAtMs > config.CBT_HEARTBEAT_STALE_MS) {
    return false;
  }
  return true;
}

/**
 * Verifies whether an authentic active CBT exam exemption applies right now.
 * Prevents stale or abandoned sessionStorage markers from disabling inactivity logout.
 */
export function hasVerifiedActiveCBTExamExemption(
  adapters?: SessionEnvironmentAdapters,
  config: SessionTimeoutConfig = SESSION_TIMEOUT_CONFIG
): boolean {
  if (!config.ACTIVE_CBT_EXEMPTION_ENABLED) return false;

  const nowMs = adapters?.now ? adapters.now() : Date.now();
  const hasMountedDom = adapters?.hasActiveMountedCBTDom
    ? adapters.hasActiveMountedCBTDom(nowMs)
    : defaultHasActiveMountedCBTDom(nowMs);

  if (hasMountedDom) {
    return true;
  }

  const ls =
    adapters && 'localStorage' in adapters
      ? adapters.localStorage ?? null
      : getDefaultLocalStorage();

  if (ls) {
    try {
      const rawHeartbeat = ls.getItem(SESSION_CBT_HEARTBEAT_STORAGE_KEY);
      if (rawHeartbeat) {
        const parsed = JSON.parse(rawHeartbeat);
        if (isValidCBTHeartbeatRecord(parsed, nowMs, config)) {
          return true;
        }
        // Auto-scrub expired or orphaned heartbeat so future checks stay clean
        ls.removeItem(SESSION_CBT_HEARTBEAT_STORAGE_KEY);
      }
    } catch {
      try {
        ls.removeItem(SESSION_CBT_HEARTBEAT_STORAGE_KEY);
      } catch {
        // Ignore storage errors
      }
    }
  }

  // Also scrub clearly expired/stale structured cbt_active_exam_* entries when no DOM runner
  // or valid heartbeat exists, so orphaned markers never permanently wedge logout.
  const ss =
    adapters && 'sessionStorage' in adapters
      ? adapters.sessionStorage ?? null
      : getDefaultSessionStorage();

  if (ss) {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < ss.length; i += 1) {
        const key = ss.key(i);
        if (key && key.startsWith(CBT_ACTIVE_STORAGE_PREFIX)) {
          const val = ss.getItem(key);
          if (!val) {
            keysToRemove.push(key);
            continue;
          }
          try {
            const parsed = JSON.parse(val);
            if (
              parsed &&
              typeof parsed === 'object' &&
              typeof parsed.expiresAtMs === 'number' &&
              parsed.expiresAtMs > nowMs
            ) {
              return true;
            }
            keysToRemove.push(key);
          } catch {
            // Legacy plain string marker with NO mounted DOM and NO live heartbeat -> stale
            keysToRemove.push(key);
          }
        }
      }
      for (const key of keysToRemove) {
        ss.removeItem(key);
      }
    } catch {
      // Ignore storage errors
    }
  }

  return false;
}

export function publishCBTExamHeartbeat(
  heartbeat: CBTExamHeartbeatRecord,
  adapters?: SessionEnvironmentAdapters
): void {
  const ls =
    adapters && 'localStorage' in adapters
      ? adapters.localStorage ?? null
      : getDefaultLocalStorage();

  if (ls) {
    try {
      ls.setItem(SESSION_CBT_HEARTBEAT_STORAGE_KEY, JSON.stringify(heartbeat));
    } catch {
      // Ignore quota errors
    }
  }

  const ss =
    adapters && 'sessionStorage' in adapters
      ? adapters.sessionStorage ?? null
      : getDefaultSessionStorage();

  if (ss) {
    try {
      ss.setItem(
        `${CBT_ACTIVE_STORAGE_PREFIX}${heartbeat.studentId}`,
        JSON.stringify({
          examId: heartbeat.examId,
          sessionId: heartbeat.sessionId,
          expiresAtMs: heartbeat.expiresAtMs,
          updatedAtMs: heartbeat.updatedAtMs,
        })
      );
    } catch {
      // Ignore quota errors
    }
  }

  const channel = adapters?.createBroadcastChannel
    ? adapters.createBroadcastChannel(SESSION_SYNC_CHANNEL_NAME)
    : getDefaultBroadcastChannel(SESSION_SYNC_CHANNEL_NAME);

  if (channel) {
    try {
      const message: SessionSyncMessage = {
        type: 'CBT_HEARTBEAT',
        heartbeat,
        tabId: 'cbt-runner',
        sentAtMs: heartbeat.updatedAtMs,
      };
      channel.postMessage(message);
    } catch {
      // Ignore channel failures
    } finally {
      try {
        channel.close();
      } catch {
        // Ignore close errors
      }
    }
  }
}

export function clearCBTExamHeartbeat(
  studentId?: string,
  adapters?: SessionEnvironmentAdapters
): void {
  const nowMs = adapters?.now ? adapters.now() : Date.now();
  const ls =
    adapters && 'localStorage' in adapters
      ? adapters.localStorage ?? null
      : getDefaultLocalStorage();

  if (ls) {
    try {
      ls.removeItem(SESSION_CBT_HEARTBEAT_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  }

  const ss =
    adapters && 'sessionStorage' in adapters
      ? adapters.sessionStorage ?? null
      : getDefaultSessionStorage();

  if (ss) {
    try {
      if (studentId) {
        ss.removeItem(`${CBT_ACTIVE_STORAGE_PREFIX}${studentId}`);
      } else {
        const keysToRemove: string[] = [];
        for (let i = 0; i < ss.length; i += 1) {
          const key = ss.key(i);
          if (key && key.startsWith(CBT_ACTIVE_STORAGE_PREFIX)) {
            keysToRemove.push(key);
          }
        }
        for (const key of keysToRemove) {
          ss.removeItem(key);
        }
      }
    } catch {
      // Ignore storage errors
    }
  }

  const channel = adapters?.createBroadcastChannel
    ? adapters.createBroadcastChannel(SESSION_SYNC_CHANNEL_NAME)
    : getDefaultBroadcastChannel(SESSION_SYNC_CHANNEL_NAME);

  if (channel) {
    try {
      const message: SessionSyncMessage = {
        type: 'CBT_ENDED',
        studentId,
        tabId: 'cbt-runner',
        sentAtMs: nowMs,
      };
      channel.postMessage(message);
    } catch {
      // Ignore channel failures
    } finally {
      try {
        channel.close();
      } catch {
        // Ignore close errors
      }
    }
  }
}

export function clearScopedSessionSyncStorage(adapters?: SessionEnvironmentAdapters): void {
  const ls =
    adapters && 'localStorage' in adapters
      ? adapters.localStorage ?? null
      : getDefaultLocalStorage();
  if (ls) {
    try {
      ls.removeItem(SESSION_ACTIVITY_STORAGE_KEY);
      ls.removeItem(SESSION_SYNC_EVENT_STORAGE_KEY);
      ls.removeItem(SESSION_CBT_HEARTBEAT_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  }
}

/**
 * Fallback helper used when network sign-out fails/times out offline:
 * removes only Supabase Auth token entries (`sb-*-auth-token`) while preserving
 * public school settings, news, gallery, and PWA assets.
 */
export function purgeSupabaseAuthTokensOnFailure(adapters?: SessionEnvironmentAdapters): void {
  const ls =
    adapters && 'localStorage' in adapters
      ? adapters.localStorage ?? null
      : getDefaultLocalStorage();
  if (!ls) return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < ls.length; i += 1) {
      const key = ls.key(i);
      if (key && /^sb-.*-auth-token/i.test(key)) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      ls.removeItem(key);
    }
  } catch {
    // Ignore storage errors
  }
}

export function readStoredActivityTimestamp(
  userScope: string,
  adapters?: SessionEnvironmentAdapters
): number | null {
  const ls =
    adapters && 'localStorage' in adapters
      ? adapters.localStorage ?? null
      : getDefaultLocalStorage();
  if (!ls) return null;
  try {
    const raw = ls.getItem(SESSION_ACTIVITY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { userScope?: unknown; lastActivityAtMs?: unknown };
    if (
      parsed &&
      parsed.userScope === userScope &&
      typeof parsed.lastActivityAtMs === 'number' &&
      Number.isFinite(parsed.lastActivityAtMs)
    ) {
      return parsed.lastActivityAtMs;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

export function writeStoredActivityTimestamp(
  userScope: string,
  lastActivityAtMs: number,
  adapters?: SessionEnvironmentAdapters
): void {
  const ls =
    adapters && 'localStorage' in adapters
      ? adapters.localStorage ?? null
      : getDefaultLocalStorage();
  if (!ls) return;
  try {
    ls.setItem(
      SESSION_ACTIVITY_STORAGE_KEY,
      JSON.stringify({ userScope, lastActivityAtMs })
    );
  } catch {
    // Ignore quota errors
  }
}

export function saveSessionExpiredNotice(
  message: string | null,
  adapters?: SessionEnvironmentAdapters
): void {
  const ss =
    adapters && 'sessionStorage' in adapters
      ? adapters.sessionStorage ?? null
      : getDefaultSessionStorage();
  if (!ss) return;
  try {
    if (message) {
      ss.setItem(SESSION_EXPIRED_NOTICE_STORAGE_KEY, message);
    } else {
      ss.removeItem(SESSION_EXPIRED_NOTICE_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

export function readSessionExpiredNotice(adapters?: SessionEnvironmentAdapters): string | null {
  const ss =
    adapters && 'sessionStorage' in adapters
      ? adapters.sessionStorage ?? null
      : getDefaultSessionStorage();
  if (!ss) return null;
  try {
    const val = ss.getItem(SESSION_EXPIRED_NOTICE_STORAGE_KEY);
    return val && val.trim().length > 0 ? val : null;
  } catch {
    return null;
  }
}

export interface IdleControllerSnapshot {
  status: IdleStatusKind;
  isWarningOpen: boolean;
  countdownSeconds: number;
  lastActivityAtMs: number;
  cbtExamActive: boolean;
}

export interface IdleSessionControllerOptions {
  userScope: string;
  config?: SessionTimeoutConfig;
  adapters?: SessionEnvironmentAdapters;
  resetStoredTimestampOnStart?: boolean;
  onSnapshotChange: (snapshot: IdleControllerSnapshot) => void;
  onTimeoutLogout: () => Promise<void> | void;
  onManualLogout: () => Promise<void> | void;
  onRemoteLogout: (reason: LogoutTriggerReason) => void;
}

/**
 * Deterministic, multi-tab-coordinated idle timeout controller.
 * Designed for direct use by React hooks and unit tests without React dependencies.
 */
export class IdleSessionController {
  private readonly userScope: string;
  private readonly config: SessionTimeoutConfig;
  private readonly adapters: SessionEnvironmentAdapters;
  private readonly onSnapshotChange: (snapshot: IdleControllerSnapshot) => void;
  private readonly onTimeoutLogout: () => Promise<void> | void;
  private readonly onManualLogout: () => Promise<void> | void;
  private readonly onRemoteLogout: (reason: LogoutTriggerReason) => void;

  private readonly tabId: string;
  private channel: BroadcastChannelLike | null = null;
  private lastActivityAtMs: number;
  private lastThrottledPingMs = 0;
  private wasCBTExamActive = false;
  private logoutInProgress = false;
  private destroyed = false;
  private lastSnapshotKey = '';

  constructor(options: IdleSessionControllerOptions) {
    this.userScope = options.userScope;
    this.config = options.config ?? SESSION_TIMEOUT_CONFIG;
    this.adapters = options.adapters ?? {};
    this.onSnapshotChange = options.onSnapshotChange;
    this.onTimeoutLogout = options.onTimeoutLogout;
    this.onManualLogout = options.onManualLogout;
    this.onRemoteLogout = options.onRemoteLogout;
    this.tabId = `tab-${this.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const nowMs = this.now();
    const existing = options.resetStoredTimestampOnStart
      ? null
      : readStoredActivityTimestamp(this.userScope, this.adapters);
    this.lastActivityAtMs = existing !== null ? existing : nowMs;
    writeStoredActivityTimestamp(this.userScope, this.lastActivityAtMs, this.adapters);

    this.channel = this.adapters.createBroadcastChannel
      ? this.adapters.createBroadcastChannel(SESSION_SYNC_CHANNEL_NAME)
      : getDefaultBroadcastChannel(SESSION_SYNC_CHANNEL_NAME);

    if (this.channel) {
      this.channel.onmessage = (event) => {
        if (!this.destroyed) {
          this.handleIncomingSyncMessage(event.data);
        }
      };
    }

    this.evaluate();
  }

  private now(): number {
    return this.adapters.now ? this.adapters.now() : Date.now();
  }

  private broadcastMessage(message: SessionSyncMessage): void {
    if (this.channel) {
      try {
        this.channel.postMessage(message);
      } catch {
        // Ignore BroadcastChannel errors
      }
    }

    const ls =
      'localStorage' in this.adapters
        ? this.adapters.localStorage ?? null
        : getDefaultLocalStorage();

    if (ls) {
      try {
        ls.setItem(SESSION_SYNC_EVENT_STORAGE_KEY, JSON.stringify(message));
      } catch {
        // Ignore quota errors
      }
    }
  }

  handleStorageEvent(key: string | null, newValue: string | null): void {
    if (this.destroyed || !newValue) return;
    if (key === SESSION_SYNC_EVENT_STORAGE_KEY) {
      try {
        this.handleIncomingSyncMessage(JSON.parse(newValue));
      } catch {
        // Ignore malformed payloads
      }
    } else if (key === SESSION_ACTIVITY_STORAGE_KEY) {
      try {
        const parsed = JSON.parse(newValue) as {
          userScope?: unknown;
          lastActivityAtMs?: unknown;
        };
        if (
          parsed &&
          parsed.userScope === this.userScope &&
          typeof parsed.lastActivityAtMs === 'number' &&
          parsed.lastActivityAtMs > this.lastActivityAtMs
        ) {
          this.lastActivityAtMs = parsed.lastActivityAtMs;
          this.evaluate();
        }
      } catch {
        // Ignore malformed payloads
      }
    } else if (key === SESSION_CBT_HEARTBEAT_STORAGE_KEY) {
      this.evaluate();
    }
  }

  private handleIncomingSyncMessage(raw: unknown): void {
    if (!raw || typeof raw !== 'object') return;
    const msg = raw as SessionSyncMessage;
    if (!('type' in msg) || msg.tabId === this.tabId) return;

    if (msg.type === 'CBT_HEARTBEAT' || msg.type === 'CBT_ENDED') {
      if (msg.type === 'CBT_ENDED' && this.wasCBTExamActive) {
        this.lastActivityAtMs = this.now();
        writeStoredActivityTimestamp(this.userScope, this.lastActivityAtMs, this.adapters);
      }
      this.evaluate();
      return;
    }

    if (msg.userScope !== this.userScope) return;

    if (msg.type === 'ACTIVITY_UPDATE' || msg.type === 'STAY_LOGGED_IN') {
      if (msg.lastActivityAtMs > this.lastActivityAtMs) {
        this.lastActivityAtMs = msg.lastActivityAtMs;
        writeStoredActivityTimestamp(this.userScope, this.lastActivityAtMs, this.adapters);
        this.evaluate();
      }
      return;
    }

    if (msg.type === 'LOGOUT_TRIGGERED') {
      if (this.logoutInProgress) return;
      this.logoutInProgress = true;
      clearScopedSessionSyncStorage(this.adapters);
      this.onRemoteLogout(msg.reason);
    }
  }

  /**
   * Records genuine user interaction. Throttles updates when not in warning state
   * so pointermove/scroll bursts never cause excessive storage writes or re-renders.
   */
  recordUserActivity(force = false): void {
    if (this.destroyed || this.logoutInProgress) return;
    const nowMs = this.now();

    // Check if an unmonitored idle period already elapsed (e.g. wakeup/first click after sleep)
    const cbtActive = hasVerifiedActiveCBTExamExemption(this.adapters, this.config);
    const preEval = evaluateIdleStatus({
      lastActivityAtMs: this.lastActivityAtMs,
      nowMs,
      cbtExamActive: cbtActive,
      config: this.config,
    });
    if (preEval.status === 'expired') {
      this.triggerTimeoutLogout();
      return;
    }

    if (!force && nowMs - this.lastThrottledPingMs < this.config.ACTIVITY_THROTTLE_MS) {
      return;
    }

    this.lastThrottledPingMs = nowMs;
    this.lastActivityAtMs = nowMs;
    writeStoredActivityTimestamp(this.userScope, nowMs, this.adapters);

    this.broadcastMessage({
      type: 'ACTIVITY_UPDATE',
      userScope: this.userScope,
      lastActivityAtMs: nowMs,
      tabId: this.tabId,
      sentAtMs: nowMs,
    });

    this.evaluate();
  }

  stayLoggedIn(): void {
    if (this.destroyed || this.logoutInProgress) return;
    const nowMs = this.now();
    this.lastThrottledPingMs = nowMs;
    this.lastActivityAtMs = nowMs;
    writeStoredActivityTimestamp(this.userScope, nowMs, this.adapters);

    this.broadcastMessage({
      type: 'STAY_LOGGED_IN',
      userScope: this.userScope,
      lastActivityAtMs: nowMs,
      tabId: this.tabId,
      sentAtMs: nowMs,
    });

    this.evaluate();
  }

  logoutNow(): void {
    if (this.destroyed || this.logoutInProgress) return;
    this.logoutInProgress = true;
    const nowMs = this.now();
    this.broadcastMessage({
      type: 'LOGOUT_TRIGGERED',
      userScope: this.userScope,
      reason: 'manual',
      tabId: this.tabId,
      sentAtMs: nowMs,
    });
    clearScopedSessionSyncStorage(this.adapters);
    void this.onManualLogout();
  }

  private triggerTimeoutLogout(): void {
    if (this.destroyed || this.logoutInProgress) return;
    this.logoutInProgress = true;
    const nowMs = this.now();
    this.broadcastMessage({
      type: 'LOGOUT_TRIGGERED',
      userScope: this.userScope,
      reason: 'inactivity',
      tabId: this.tabId,
      sentAtMs: nowMs,
    });
    clearScopedSessionSyncStorage(this.adapters);
    void this.onTimeoutLogout();
  }

  evaluate(): IdleControllerSnapshot {
    const nowMs = this.now();

    // Sync with any newer activity recorded in another tab via localStorage
    const storedTs = readStoredActivityTimestamp(this.userScope, this.adapters);
    if (storedTs !== null && storedTs > this.lastActivityAtMs) {
      this.lastActivityAtMs = storedTs;
    }

    const cbtActive = hasVerifiedActiveCBTExamExemption(this.adapters, this.config);

    // If an active CBT exam just ended/expired, reset the inactivity baseline to now
    // so the user gets a clean fresh 25-minute countdown afterward.
    if (this.wasCBTExamActive && !cbtActive) {
      this.lastActivityAtMs = nowMs;
      writeStoredActivityTimestamp(this.userScope, nowMs, this.adapters);
    }
    this.wasCBTExamActive = cbtActive;

    const evaluation = evaluateIdleStatus({
      lastActivityAtMs: this.lastActivityAtMs,
      nowMs,
      cbtExamActive: cbtActive,
      config: this.config,
    });

    const snapshot: IdleControllerSnapshot = {
      status: evaluation.status,
      isWarningOpen: evaluation.status === 'warning' && !this.logoutInProgress,
      countdownSeconds: evaluation.warningCountdownSeconds,
      lastActivityAtMs: this.lastActivityAtMs,
      cbtExamActive: cbtActive,
    };

    const nextKey = `${snapshot.status}|${snapshot.isWarningOpen}|${snapshot.countdownSeconds}|${snapshot.cbtExamActive}`;
    if (nextKey !== this.lastSnapshotKey) {
      this.lastSnapshotKey = nextKey;
      this.onSnapshotChange(snapshot);
    }

    if (evaluation.status === 'expired' && !this.logoutInProgress) {
      this.triggerTimeoutLogout();
    }

    return snapshot;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.channel) {
      this.channel.onmessage = null;
      try {
        this.channel.close();
      } catch {
        // Ignore close errors
      }
      this.channel = null;
    }
  }
}
