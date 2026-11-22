import type { CBTAttempt, CBTExam, CBTExamSession, CBTQuestion, Student } from '../types';
import { doesStudentClassMatch } from './academicSelection';

export interface MonotonicCountdownAnchor {
  initialRemainingSeconds: number;
  startPerfMs: number;
  startWallMs: number;
}

const DATE_YYYY_MM_DD_RE = /^\d{4}-\d{2}-\d{2}$/;

const parseIsoDateUtc = (dateStr: string): Date | null => {
  if (!DATE_YYYY_MM_DD_RE.test(dateStr)) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }
  return dt;
};

const formatUtcDate = (dt: Date): string => dt.toISOString().split('T')[0];

/**
 * Computes a valid future-safe closing date (`YYYY-MM-DD`) relative to
 * `max(startDate, today) + offsetDays` so exams and cloned past papers
 * never silently lock out students with stale hardcoded dates.
 */
export function computeSafeExamEndDate(
  startDate?: string,
  offsetDays = 30,
  referenceNow: Date = new Date()
): string {
  const todayStr = formatUtcDate(referenceNow);
  const todayDt = parseIsoDateUtc(todayStr) ?? new Date();
  const parsedStart = startDate ? parseIsoDateUtc(startDate) : null;
  const baseDt = parsedStart && parsedStart.getTime() > todayDt.getTime() ? parsedStart : todayDt;
  const endDt = new Date(baseDt.getTime() + Math.max(1, offsetDays) * 86_400_000);
  return formatUtcDate(endDt);
}

export interface CBTScheduleValidationInput {
  startDate: string;
  endDate: string;
  durationMinutes: number;
  passPercentage?: number;
}

export function validateCBTExamSchedule(input: CBTScheduleValidationInput): string | null {
  if (!Number.isFinite(input.durationMinutes) || input.durationMinutes < 1 || input.durationMinutes > 300) {
    return 'Examination duration must be between 1 and 300 minutes.';
  }

  if (
    input.passPercentage !== undefined &&
    (!Number.isFinite(input.passPercentage) || input.passPercentage < 1 || input.passPercentage > 100)
  ) {
    return 'Pass percentage must be between 1% and 100%.';
  }

  const startDt = parseIsoDateUtc(input.startDate);
  if (!startDt) {
    return 'Please select a valid Start Date (YYYY-MM-DD).';
  }

  const endDt = parseIsoDateUtc(input.endDate);
  if (!endDt) {
    return 'Please select a valid Closing End Date (YYYY-MM-DD).';
  }

  if (endDt.getTime() < startDt.getTime()) {
    return 'Examination End Date cannot be earlier than the Start Date.';
  }

  return null;
}

/**
 * Returns a monotonic clock timestamp (`performance.now()` when available)
 * so backwards changes to the student's OS wall clock cannot extend the timer.
 */
export function getMonotonicClockMs(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

export function createMonotonicCountdownAnchor(
  serverRemainingSeconds: number,
  nowPerfMs: number = getMonotonicClockMs(),
  nowWallMs: number = Date.now()
): MonotonicCountdownAnchor {
  const safeRemaining = Number.isFinite(serverRemainingSeconds)
    ? Math.max(0, Math.floor(serverRemainingSeconds))
    : 0;

  return {
    initialRemainingSeconds: safeRemaining,
    startPerfMs: nowPerfMs,
    startWallMs: nowWallMs,
  };
}

export function computeRemainingSecondsMonotonic(
  anchor: MonotonicCountdownAnchor,
  currentPerfMs: number = getMonotonicClockMs()
): number {
  if (anchor.initialRemainingSeconds <= 0) return 0;
  const elapsedSeconds = Math.max(0, (currentPerfMs - anchor.startPerfMs) / 1000);
  return Math.max(0, Math.ceil(anchor.initialRemainingSeconds - elapsedSeconds));
}

/**
 * Detects OS sleep/suspend or wall-clock tampering where wall-clock elapsed time
 * diverges significantly from monotonic `performance.now()` elapsed time.
 * Triggers an authoritative server session resync when true.
 */
export function hasClockJumpOrSleepDrift(
  anchor: MonotonicCountdownAnchor,
  currentPerfMs: number = getMonotonicClockMs(),
  currentWallMs: number = Date.now(),
  thresholdSeconds = 15
): boolean {
  const perfElapsedSec = Math.max(0, (currentPerfMs - anchor.startPerfMs) / 1000);
  const wallElapsedSec = (currentWallMs - anchor.startWallMs) / 1000;
  return Math.abs(wallElapsedSec - perfElapsedSec) >= thresholdSeconds;
}

/**
 * Identifies terminal server-side CBT session errors where retrying draft saves
 * or submissions is futile because the exam window closed or was already graded.
 */
export function isTerminalCBTSessionError(message?: string | null): boolean {
  if (!message) return false;
  return /expired|already completed|already been completed|already been submitted|completed attempt already exists|window for this cbt closed|session is closed/i.test(
    message
  );
}

/**
 * Computes jittered exponential backoff delay in milliseconds so 30+ students
 * reconnecting after a brief Wi-Fi dropout do not stampede Supabase simultaneously.
 */
export function computeRetryDelayMs(
  retryAttempt: number,
  baseMs = 1500,
  maxMs = 15000,
  jitterRatio = 0.25,
  randomValue: number = Math.random()
): number {
  const exp = Math.min(maxMs, baseMs * Math.pow(2, Math.max(0, retryAttempt - 1)));
  const clampedRand = Math.min(1, Math.max(0, randomValue));
  const jitterFactor = 1 + (clampedRand * 2 - 1) * jitterRatio;
  return Math.max(250, Math.round(exp * jitterFactor));
}

export type DraftSyncState = 'idle' | 'saving' | 'saved' | 'pending_retry' | 'terminal_error';

export interface DraftSaverStatusSnapshot {
  state: DraftSyncState;
  hasUnsyncedChanges: boolean;
  retryCount: number;
  lastError: string | null;
  terminalError: boolean;
}

/**
 * Single-flight, revision-tracked draft saver that guarantees:
 * 1. Only one draft save RPC runs at a time per exam runner (no out-of-order overwrites).
 * 2. Answers selected while a save is in-flight automatically schedule a follow-up flush
 *    and keep `hasUnsyncedChanges = true` until the latest revision is confirmed saved.
 * 3. Transient failures schedule jittered backoff retries; terminal session errors stop retries.
 */
export class CoalescedDraftSaver {
  private latestRevision = 0;
  private syncedRevision = 0;
  private latestSnapshot: Record<string, string> = {};
  private inFlight = false;
  private retryCount = 0;
  private lastError: string | null = null;
  private terminalError = false;
  private disposed = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly saveFn: (
      answers: Record<string, string>
    ) => Promise<{ ok: boolean; error?: string }>,
    private readonly onStatusChange?: (status: DraftSaverStatusSnapshot) => void,
    private readonly delayCalculator: (attempt: number) => number = (attempt) =>
      computeRetryDelayMs(attempt)
  ) {}

  getStatus(): DraftSaverStatusSnapshot {
    const hasUnsyncedChanges = this.latestRevision > this.syncedRevision;
    let state: DraftSyncState = 'idle';
    if (this.terminalError) {
      state = 'terminal_error';
    } else if (this.inFlight) {
      state = 'saving';
    } else if (this.lastError && hasUnsyncedChanges) {
      state = 'pending_retry';
    } else if (!hasUnsyncedChanges && this.syncedRevision > 0) {
      state = 'saved';
    } else if (hasUnsyncedChanges) {
      state = 'pending_retry';
    }

    return {
      state,
      hasUnsyncedChanges,
      retryCount: this.retryCount,
      lastError: this.lastError,
      terminalError: this.terminalError,
    };
  }

  private emit() {
    this.onStatusChange?.(this.getStatus());
  }

  private clearRetryTimer() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  markPending(answers: Record<string, string>) {
    if (this.disposed || this.terminalError) return;
    this.latestRevision += 1;
    this.latestSnapshot = { ...answers };
    this.emit();
  }

  async flush(answers?: Record<string, string>): Promise<boolean> {
    if (this.disposed || this.terminalError) return false;
    if (answers) {
      this.latestRevision += 1;
      this.latestSnapshot = { ...answers };
    }

    this.clearRetryTimer();

    if (this.latestRevision <= this.syncedRevision) {
      this.emit();
      return true;
    }

    if (this.inFlight) {
      this.emit();
      return false;
    }

    this.inFlight = true;
    const targetRevision = this.latestRevision;
    const payload = { ...this.latestSnapshot };
    this.emit();

    let savedSuccessfully = false;
    try {
      if (Object.keys(payload).length === 0) {
        this.syncedRevision = Math.max(this.syncedRevision, targetRevision);
        this.lastError = null;
        this.retryCount = 0;
        savedSuccessfully = true;
      } else {
        const res = await this.saveFn(payload);
        if (this.disposed) return false;

        if (res.ok) {
          this.syncedRevision = Math.max(this.syncedRevision, targetRevision);
          this.lastError = null;
          this.retryCount = 0;
          savedSuccessfully = true;
        } else {
          const errMsg = res.error || 'Unable to sync draft answers right now.';
          this.lastError = errMsg;
          if (isTerminalCBTSessionError(errMsg)) {
            this.terminalError = true;
            this.clearRetryTimer();
          } else {
            this.retryCount += 1;
            const delay = this.delayCalculator(this.retryCount);
            this.retryTimer = setTimeout(() => {
              void this.flush();
            }, delay);
          }
        }
      }
    } catch (err) {
      if (this.disposed) return false;
      const errMsg = err instanceof Error ? err.message : 'Network connection error while saving.';
      this.lastError = errMsg;
      if (isTerminalCBTSessionError(errMsg)) {
        this.terminalError = true;
        this.clearRetryTimer();
      } else {
        this.retryCount += 1;
        const delay = this.delayCalculator(this.retryCount);
        this.retryTimer = setTimeout(() => {
          void this.flush();
        }, delay);
      }
    } finally {
      this.inFlight = false;
      this.emit();
    }

    // If newer answers arrived while the previous save was in flight, flush immediately
    if (!this.disposed && !this.terminalError && savedSuccessfully && this.latestRevision > this.syncedRevision) {
      return this.flush();
    }

    return savedSuccessfully && this.latestRevision === this.syncedRevision;
  }

  dispose() {
    this.disposed = true;
    this.clearRetryTimer();
  }
}

export interface SubmissionReadinessSummary {
  totalQuestions: number;
  answeredCount: number;
  unansweredCount: number;
  flaggedCount: number;
  unansweredQuestionNumbers: number[];
}

export function summarizeSubmissionReadiness(
  questions: readonly CBTQuestion[],
  userAnswers: Record<string, string>,
  flaggedQuestions: Record<string, boolean>
): SubmissionReadinessSummary {
  const unansweredQuestionNumbers: number[] = [];
  let answeredCount = 0;
  let flaggedCount = 0;

  questions.forEach((q, idx) => {
    const val = userAnswers[q.id];
    if (typeof val === 'string' && val.trim().length > 0) {
      answeredCount += 1;
    } else {
      unansweredQuestionNumbers.push(idx + 1);
    }
    if (flaggedQuestions[q.id]) {
      flaggedCount += 1;
    }
  });

  return {
    totalQuestions: questions.length,
    answeredCount,
    unansweredCount: questions.length - answeredCount,
    flaggedCount,
    unansweredQuestionNumbers,
  };
}

export interface ExamParticipationEntry {
  student: Student;
  attempt?: CBTAttempt;
  session?: CBTExamSession;
}

export interface ExamParticipationBreakdown {
  eligibleCount: number;
  submitted: ExamParticipationEntry[];
  inProgress: ExamParticipationEntry[];
  expired: ExamParticipationEntry[];
  notStarted: ExamParticipationEntry[];
}

/**
 * Classifies all active eligible students in the exam's class into
 * Submitted, In-Progress, Expired (timed out without submission), and Not Started.
 */
export function classifyExamParticipation(params: {
  exam: Pick<CBTExam, 'id' | 'classId' | 'className'>;
  students: readonly Student[];
  attempts: readonly CBTAttempt[];
  sessions: readonly CBTExamSession[];
  nowMs?: number;
}): ExamParticipationBreakdown {
  const nowMs = params.nowMs ?? Date.now();
  const eligibleStudents = params.students.filter(
    (s) => s.status === 'Active' && doesStudentClassMatch(params.exam.classId, params.exam.className, s)
  );

  const attemptByStudent = new Map<string, CBTAttempt>();
  for (const att of params.attempts) {
    if (att.examId === params.exam.id) {
      attemptByStudent.set(att.studentId, att);
    }
  }

  const sessionByStudent = new Map<string, CBTExamSession>();
  for (const sess of params.sessions) {
    if (sess.examId === params.exam.id) {
      sessionByStudent.set(sess.studentId, sess);
    }
  }

  const submitted: ExamParticipationEntry[] = [];
  const inProgress: ExamParticipationEntry[] = [];
  const expired: ExamParticipationEntry[] = [];
  const notStarted: ExamParticipationEntry[] = [];

  for (const student of eligibleStudents) {
    const attempt = attemptByStudent.get(student.id);
    const session = sessionByStudent.get(student.id);

    if (attempt) {
      submitted.push({ student, attempt, session });
    } else if (session) {
      const expiresAtMs = Date.parse(session.expiresAt);
      const isExpiredTime = Number.isFinite(expiresAtMs) && expiresAtMs <= nowMs;
      if (session.status === 'submitted') {
        submitted.push({ student, session });
      } else if (session.status === 'expired' || isExpiredTime) {
        expired.push({ student, session });
      } else {
        inProgress.push({ student, session });
      }
    } else {
      notStarted.push({ student });
    }
  }

  // Include any legacy/submitted attempts whose student was graduated/transferred after taking the exam
  for (const att of attemptByStudent.values()) {
    if (!eligibleStudents.some((s) => s.id === att.studentId)) {
      submitted.push({
        student: {
          id: att.studentId,
          admissionNo: att.admissionNo,
          firstName: att.studentName,
          lastName: '',
          gender: 'Male',
          dob: '',
          classId: params.exam.classId,
          className: params.exam.className,
          arm: '',
          parentName: '',
          parentPhone: '',
          parentEmail: '',
          address: '',
          avatar: '',
          status: 'Active',
        },
        attempt: att,
        session: sessionByStudent.get(att.studentId),
      });
    }
  }

  return {
    eligibleCount: eligibleStudents.length,
    submitted,
    inProgress,
    expired,
    notStarted,
  };
}
