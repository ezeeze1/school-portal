/**
 * Centralized session inactivity timeout policy for Divine Academy Secondary School Portal.
 * Applies to all authenticated portal roles (admin, teacher, student, parent) and is
 * automatically paused during verified active CBT examinations.
 */

export interface SessionTimeoutConfig {
  readonly INACTIVITY_TIMEOUT_MS: number;
  readonly WARNING_TRIGGER_AT_MS: number;
  readonly WARNING_BEFORE_LOGOUT_MS: number;
  readonly ACTIVITY_THROTTLE_MS: number;
  readonly CBT_HEARTBEAT_INTERVAL_MS: number;
  readonly CBT_HEARTBEAT_STALE_MS: number;
  readonly ACTIVE_CBT_EXEMPTION_ENABLED: boolean;
}

export const SESSION_TIMEOUT_CONFIG: SessionTimeoutConfig = {
  INACTIVITY_TIMEOUT_MS: 25 * 60 * 1000, // 25 minutes
  WARNING_TRIGGER_AT_MS: 23 * 60 * 1000, // 23 minutes (2 minutes remaining)
  WARNING_BEFORE_LOGOUT_MS: 2 * 60 * 1000, // 2 minutes warning countdown
  ACTIVITY_THROTTLE_MS: 1000, // Throttle high-frequency input events cleanly
  CBT_HEARTBEAT_INTERVAL_MS: 10 * 1000, // 10s heartbeat while CBT runner is open
  CBT_HEARTBEAT_STALE_MS: 45 * 1000, // 45s staleness window for cross-tab/orphaned markers
  ACTIVE_CBT_EXEMPTION_ENABLED: true,
} as const;

export const SESSION_WARNING_TITLE = 'Session Expiring Soon';

export const SESSION_WARNING_MESSAGE =
  'For your security, you will be automatically logged out in 2 minutes due to inactivity. Click Stay Logged In to continue your session.';

export const SESSION_EXPIRED_LOGOUT_MESSAGE =
  'You have been automatically logged out after 25 minutes of inactivity for your security. Please log in again to continue.';

export const SESSION_SYNC_CHANNEL_NAME = 'divine_academy_session_sync_v1';
export const SESSION_ACTIVITY_STORAGE_KEY = 'da_session_last_activity_v1';
export const SESSION_SYNC_EVENT_STORAGE_KEY = 'da_session_sync_event_v1';
export const SESSION_CBT_HEARTBEAT_STORAGE_KEY = 'da_cbt_exam_heartbeat_v1';
export const SESSION_EXPIRED_NOTICE_STORAGE_KEY = 'da_session_expired_notice_v1';

export const GENUINE_USER_ACTIVITY_EVENTS = [
  'pointerdown',
  'pointermove',
  'mousedown',
  'mousemove',
  'click',
  'keydown',
  'touchstart',
  'touchmove',
  'scroll',
] as const;
