import type { AuthChangeEvent } from '@supabase/supabase-js';
import type { User, UserProfile, UserRole } from '../types';
import type { SupabasePortalSnapshot } from '../services/supabaseSchoolService';
import { isInternalStudentAuthEmail } from './accountProvisioning';
import { purgeSupabaseAuthTokensOnFailure } from './sessionActivity';

export type AuthenticatedPortalRole = Exclude<UserRole, 'public'>;

export interface AuthUserLike {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}

export interface AuthSessionLike {
  user: AuthUserLike | null;
}

export interface AuthClientLike {
  getSession(): Promise<{
    data: { session: AuthSessionLike | null };
    error?: { message: string } | null;
  }>;
  signInWithPassword(credentials: { email: string; password: string }): Promise<{
    data: { user: AuthUserLike | null; session: AuthSessionLike | null };
    error: { message: string } | null;
  }>;
  setSession?(tokens: { access_token: string; refresh_token: string }): Promise<{
    data: { user: AuthUserLike | null; session: AuthSessionLike | null };
    error: { message: string } | null;
  }>;
  signOut(options?: {
    scope?: 'global' | 'local' | 'others';
  }): Promise<{ error?: { message: string } | null } | void>;
  onAuthStateChange(
    callback: (event: AuthChangeEvent, session: AuthSessionLike | null) => void
  ): {
    data: { subscription: { unsubscribe: () => void } };
  };
}

export interface AuthProfileServiceLike {
  syncMyUserProfile(): Promise<{ profile: UserProfile | null; error?: string }>;
  fetchPortalSnapshot(role: UserRole): Promise<SupabasePortalSnapshot>;
}

export type HydrationFailureReason =
  | 'no_profile'
  | 'inactive_profile'
  | 'invalid_role'
  | 'rpc_error'
  | 'superseded'
  | 'unmounted';

export interface HydrationSuccess {
  ok: true;
  role: AuthenticatedPortalRole;
  userId: string;
}

export interface HydrationFailure {
  ok: false;
  reason: HydrationFailureReason;
  error: string;
}

export type HydrationResult = HydrationSuccess | HydrationFailure;

function isHydrationFailure(result: HydrationResult): result is HydrationFailure {
  return result.ok === false;
}

export interface AuthCoordinatorCallbacks {
  setAuthLoading: (loading: boolean) => void;
  applyPublicSnapshot: () => Promise<void>;
  applyAuthenticatedSession: (payload: {
    user: User;
    profile: UserProfile;
    snapshot: SupabasePortalSnapshot;
    navigateToPortal: boolean;
    mustChangePassword: boolean;
  }) => void;
  resetToPublic: (options?: { navigateHome?: boolean }) => void;
}

const VALID_AUTHENTICATED_ROLES: ReadonlySet<AuthenticatedPortalRole> = new Set([
  'admin',
  'teacher',
  'student',
  'parent',
]);

export function isValidAuthenticatedRole(role: unknown): role is AuthenticatedPortalRole {
  return typeof role === 'string' && VALID_AUTHENTICATED_ROLES.has(role as AuthenticatedPortalRole);
}

/**
 * Distinguishes explicit invalid/expired auth token failures (which should
 * trigger a clean sign-out during session bootstrap) from transient network
 * outages (which should keep the persisted refresh token intact).
 */
export function isInvalidSessionError(message?: string): boolean {
  if (!message) return false;
  return /authentication required|invalid jwt|jwt expired|invalid refresh token|session not found|token is expired|not authenticated/i.test(
    message
  );
}

/**
 * Resolves a verified portal User object strictly from the server-validated
 * UserProfile (`public.user_profiles` via `sync_my_user_profile()`) and the
 * role-scoped Supabase snapshot. Never falls through implicitly to `admin`.
 */
export function buildVerifiedPortalUser(
  authUser: AuthUserLike,
  profile: UserProfile,
  snapshot: SupabasePortalSnapshot
): User | null {
  if (!isValidAuthenticatedRole(profile.role)) {
    return null;
  }

  const email = profile.email || authUser.email || '';
  const metadataFullName =
    typeof authUser.user_metadata?.full_name === 'string' ? authUser.user_metadata.full_name : '';

  const loadedStudents = snapshot.students ?? [];
  const loadedTeachers = snapshot.teachers ?? [];
  const loadedParents = snapshot.parents ?? [];

  if (profile.role === 'teacher') {
    const matched = loadedTeachers.find(
      (t) =>
        t.authUserId === authUser.id ||
        (profile.referenceId && t.id === profile.referenceId) ||
        t.email.toLowerCase() === email.toLowerCase()
    );
    return {
      id: matched?.id || profile.referenceId || authUser.id,
      authUserId: authUser.id,
      name: matched
        ? `${matched.firstName} ${matched.lastName}`
        : profile.fullName || metadataFullName || 'Faculty Member',
      email,
      role: 'teacher',
      avatar: matched?.avatar,
      referenceId: matched?.staffId || profile.referenceId,
    };
  }

  if (profile.role === 'student') {
    const matched = loadedStudents.find(
      (s) =>
        s.authUserId === authUser.id ||
        (profile.referenceId && s.id === profile.referenceId) ||
        (s.email && !isInternalStudentAuthEmail(email) && s.email.toLowerCase() === email.toLowerCase())
    );
    const displayEmail =
      matched?.email && !isInternalStudentAuthEmail(matched.email)
        ? matched.email
        : isInternalStudentAuthEmail(email)
          ? ''
          : email;
    return {
      id: matched?.id || profile.referenceId || authUser.id,
      authUserId: authUser.id,
      name: matched
        ? `${matched.firstName} ${matched.lastName}`
        : profile.fullName || metadataFullName || 'Student',
      email: displayEmail,
      role: 'student',
      avatar: matched?.avatar,
      referenceId: matched?.admissionNo || profile.referenceId,
    };
  }

  if (profile.role === 'parent') {
    const matched = loadedParents.find(
      (p) =>
        p.authUserId === authUser.id ||
        (profile.referenceId && p.id === profile.referenceId) ||
        p.email.toLowerCase() === email.toLowerCase()
    );
    return {
      id: matched?.id || profile.referenceId || authUser.id,
      authUserId: authUser.id,
      name: matched
        ? matched.title
          ? `${matched.title} ${matched.fullName}`
          : matched.fullName
        : profile.fullName || metadataFullName || 'Parent / Guardian',
      email,
      role: 'parent',
      avatar:
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
      referenceId: matched?.parentId || profile.referenceId,
    };
  }

  if (profile.role === 'admin') {
    const adminDisplayName = profile.fullName || metadataFullName || 'System Administrator';
    return {
      id: profile.referenceId || 'usr-admin',
      authUserId: authUser.id,
      name: adminDisplayName,
      email,
      role: 'admin',
      avatar:
        'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=200',
      referenceId: profile.referenceId || 'ADM-001',
    };
  }

  return null;
}

interface InFlightHydration {
  userId: string;
  generation: number;
  navigateToPortal: boolean;
  promise: Promise<HydrationResult>;
}

interface InFlightSignIn {
  key: string;
  promise: Promise<{ ok: boolean; error?: string }>;
}

/**
 * Coordinates Supabase Authentication session lifecycle (`getSession`,
 * `signInWithPassword`, `onAuthStateChange`, `signOut`) with single-flight
 * hydration coalescing so concurrent auth events for the same user never
 * supersede each other or falsely sign out a valid session.
 */
export class AuthSessionCoordinator {
  private readonly auth: AuthClientLike;
  private readonly service: AuthProfileServiceLike;
  private readonly callbacks: AuthCoordinatorCallbacks;

  private sessionGeneration = 0;
  private activeEffectToken = 0;
  private isAttached = false;

  private activeAuthUserId: string | null = null;
  private activeRole: UserRole = 'public';

  private inFlightHydration: InFlightHydration | null = null;
  private inFlightSignIn: InFlightSignIn | null = null;
  private internalSignOutInFlight = false;

  private pendingTimers = new Set<ReturnType<typeof setTimeout>>();

  constructor(
    auth: AuthClientLike,
    service: AuthProfileServiceLike,
    callbacks: AuthCoordinatorCallbacks
  ) {
    this.auth = auth;
    this.service = service;
    this.callbacks = callbacks;
  }

  /**
   * Attaches exactly one `onAuthStateChange` listener and runs session bootstrap.
   * Safe under React 19 `<StrictMode>` mount -> unmount -> remount: the returned
   * cleanup unsubscribes the listener and clears deferred timers without
   * invalidating an already-running same-user hydration.
   */
  attach(): () => void {
    const effectToken = ++this.activeEffectToken;
    this.isAttached = true;

    const {
      data: { subscription },
    } = this.auth.onAuthStateChange((event, session) => {
      if (!this.isAttached || this.activeEffectToken !== effectToken) return;
      this.handleAuthStateChange(event, session);
    });

    void this.bootstrapSession(effectToken);

    return () => {
      if (this.activeEffectToken === effectToken) {
        this.isAttached = false;
      }
      this.clearPendingTimers();
      subscription.unsubscribe();
    };
  }

  private clearPendingTimers(): void {
    this.pendingTimers.forEach((timerId) => clearTimeout(timerId));
    this.pendingTimers.clear();
  }

  private scheduleDeferred(task: () => void): void {
    const effectToken = this.activeEffectToken;
    const timerId = setTimeout(() => {
      this.pendingTimers.delete(timerId);
      if (!this.isAttached || this.activeEffectToken !== effectToken) return;
      task();
    }, 0);
    this.pendingTimers.add(timerId);
  }

  private async safeSignOutInternal(localOnly = false): Promise<void> {
    this.internalSignOutInFlight = true;
    try {
      if (localOnly) {
        try {
          await this.auth.signOut({ scope: 'local' });
        } catch {
          purgeSupabaseAuthTokensOnFailure();
        }
        return;
      }

      const SIGN_OUT_TIMEOUT_MS = 5000;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      try {
        const result = await Promise.race([
          this.auth.signOut(),
          new Promise<{ error: { message: string } }>((resolve) => {
            timeoutId = setTimeout(
              () => resolve({ error: { message: 'Sign-out request timed out.' } }),
              SIGN_OUT_TIMEOUT_MS
            );
          }),
        ]);
        if (result && 'error' in result && result.error) {
          console.warn('[Auth] Remote sign-out returned error, clearing local session:', result.error);
          try {
            await this.auth.signOut({ scope: 'local' });
          } catch {
            // Fall through to token purge
          }
          purgeSupabaseAuthTokensOnFailure();
        }
      } finally {
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
        }
      }
    } catch (err) {
      console.warn('[Auth] Sign-out error, clearing local auth session:', err);
      try {
        await this.auth.signOut({ scope: 'local' });
      } catch {
        // Ignore fallback error
      }
      purgeSupabaseAuthTokensOnFailure();
    } finally {
      this.internalSignOutInFlight = false;
    }
  }

  private async bootstrapSession(effectToken: number): Promise<void> {
    const bootGeneration = this.sessionGeneration;
    this.callbacks.setAuthLoading(true);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await this.auth.getSession();

      if (!this.isAttached || this.activeEffectToken !== effectToken) return;

      // A login or logout started while getSession() was pending — do not clobber it.
      if (bootGeneration !== this.sessionGeneration || this.inFlightSignIn !== null) {
        return;
      }

      if (sessionError) {
        this.activeAuthUserId = null;
        this.activeRole = 'public';
        this.callbacks.resetToPublic({ navigateHome: false });
        if (isInvalidSessionError(sessionError.message)) {
          await this.safeSignOutInternal();
        }
        await this.callbacks.applyPublicSnapshot();
        return;
      }

      if (session?.user) {
        const result = await this.hydrateSession(session.user, {
          navigateToPortal: false,
          forceRefresh: false,
        });

        if (!this.isAttached || this.activeEffectToken !== effectToken) return;

        // Only sign out on explicit profile/role rejection or invalid token —
        // never on superseded/unmounted calls or transient network errors.
        if (
          isHydrationFailure(result) &&
          (result.reason === 'no_profile' ||
            result.reason === 'inactive_profile' ||
            result.reason === 'invalid_role' ||
            (result.reason === 'rpc_error' && isInvalidSessionError(result.error)))
        ) {
          await this.safeSignOutInternal();
        }
      } else {
        this.activeAuthUserId = null;
        this.activeRole = 'public';
        this.callbacks.resetToPublic({ navigateHome: false });
        await this.callbacks.applyPublicSnapshot();
      }
    } catch (err) {
      console.warn('[Auth] Session bootstrap failed:', err);
      if (
        this.isAttached &&
        this.activeEffectToken === effectToken &&
        bootGeneration === this.sessionGeneration &&
        this.inFlightSignIn === null
      ) {
        this.activeAuthUserId = null;
        this.activeRole = 'public';
        this.callbacks.resetToPublic({ navigateHome: false });
        await this.callbacks.applyPublicSnapshot();
      }
    } finally {
      if (this.isAttached && this.activeEffectToken === effectToken) {
        this.callbacks.setAuthLoading(false);
      }
    }
  }

  private handleAuthStateChange(
    event: AuthChangeEvent,
    session: AuthSessionLike | null
  ): void {
    // INITIAL_SESSION is handled deterministically by bootstrapSession() via getSession().
    // Never misclassify INITIAL_SESSION with a null session as SIGNED_OUT.
    if (event === 'INITIAL_SESSION') {
      return;
    }

    // Password recovery UI is intentionally disabled across all portal login interfaces.
    if (event === 'PASSWORD_RECOVERY') {
      return;
    }

    if (event === 'SIGNED_OUT') {
      if (this.internalSignOutInFlight) {
        return;
      }
      // If we are already cleanly signed out with no in-flight work, skip duplicate reset.
      if (
        this.activeAuthUserId === null &&
        this.activeRole === 'public' &&
        this.inFlightHydration === null &&
        this.inFlightSignIn === null
      ) {
        return;
      }

      this.sessionGeneration += 1;
      this.inFlightHydration = null;
      this.activeAuthUserId = null;
      this.activeRole = 'public';
      this.clearPendingTimers();
      this.callbacks.resetToPublic({ navigateHome: true });
      void this.callbacks.applyPublicSnapshot();
      return;
    }

    const sessionUser = session?.user;
    if (!sessionUser) {
      return;
    }

    if (event === 'SIGNED_IN') {
      // Active signInWithPassword() owns hydration, navigation, and error reporting.
      // Ignoring the synchronous/immediate SIGNED_IN emission prevents the duplicate
      // hydration race that previously superseded the session.
      if (this.inFlightSignIn !== null) {
        return;
      }

      // Supabase v2 re-emits SIGNED_IN on browser tab focus / visibility return for an
      // already-hydrated session. Skip redundant hydration and preserve current view.
      if (this.activeAuthUserId === sessionUser.id && this.activeRole !== 'public') {
        return;
      }

      // Defer outside GoTrue's internal auth callback lock before making REST/RPC calls.
      this.scheduleDeferred(() => {
        if (this.inFlightSignIn !== null) return;
        if (this.activeAuthUserId === sessionUser.id && this.activeRole !== 'public') return;

        void this.hydrateSession(sessionUser, { navigateToPortal: true }).then((result) => {
          if (
            isHydrationFailure(result) &&
            this.isAttached &&
            (result.reason === 'no_profile' ||
              result.reason === 'inactive_profile' ||
              result.reason === 'invalid_role')
          ) {
            void this.safeSignOutInternal();
          }
        });
      });
      return;
    }

    if (event === 'TOKEN_REFRESHED') {
      if (this.inFlightSignIn !== null) {
        return;
      }
      if (this.activeAuthUserId === sessionUser.id && this.activeRole !== 'public') {
        return;
      }
      this.scheduleDeferred(() => {
        if (this.inFlightSignIn !== null) return;
        if (this.activeAuthUserId === sessionUser.id && this.activeRole !== 'public') return;
        void this.hydrateSession(sessionUser, { navigateToPortal: false });
      });
      return;
    }

    if (event === 'USER_UPDATED') {
      if (this.inFlightSignIn !== null) {
        return;
      }
      this.scheduleDeferred(() => {
        if (this.inFlightSignIn !== null) return;
        void this.hydrateSession(sessionUser, {
          navigateToPortal: false,
          forceRefresh: true,
        });
      });
    }
  }

  /**
   * Verifies the authenticated Supabase user's role from `public.user_profiles`
   * via `sync_my_user_profile()`, loads their role-scoped snapshot, and commits
   * authenticated state. Concurrent calls for the same user in the same session
   * generation coalesce onto a single in-flight request.
   */
  hydrateSession(
    authUser: AuthUserLike,
    options?: {
      navigateToPortal?: boolean;
      forceRefresh?: boolean;
      expectedGeneration?: number;
      disallowRole?: AuthenticatedPortalRole;
    }
  ): Promise<HydrationResult> {
    const navigateToPortal = Boolean(options?.navigateToPortal);
    const forceRefresh = Boolean(options?.forceRefresh);
    const disallowRole = options?.disallowRole;

    if (
      options?.expectedGeneration !== undefined &&
      options.expectedGeneration !== this.sessionGeneration
    ) {
      return Promise.resolve({
        ok: false,
        reason: 'superseded',
        error: 'Authentication state changed before session verification completed.',
      });
    }

    // Coalesce duplicate in-flight hydration requests for the exact same user/generation.
    if (
      this.inFlightHydration &&
      this.inFlightHydration.userId === authUser.id &&
      this.inFlightHydration.generation === this.sessionGeneration
    ) {
      if (navigateToPortal) {
        this.inFlightHydration.navigateToPortal = true;
      }
      return this.inFlightHydration.promise;
    }

    // Already verified and hydrated for this user — avoid redundant network round-trips.
    if (
      !forceRefresh &&
      this.activeAuthUserId === authUser.id &&
      isValidAuthenticatedRole(this.activeRole)
    ) {
      return Promise.resolve({
        ok: true,
        role: this.activeRole,
        userId: authUser.id,
      });
    }

    // Switching from one authenticated user to a different user legitimately supersedes
    // the previous user's session and clears previous private data immediately.
    const switchingUsers =
      (this.activeAuthUserId !== null && this.activeAuthUserId !== authUser.id) ||
      (this.inFlightHydration !== null && this.inFlightHydration.userId !== authUser.id);

    if (switchingUsers) {
      this.sessionGeneration += 1;
      this.activeAuthUserId = null;
      this.activeRole = 'public';
      this.callbacks.resetToPublic({ navigateHome: false });
    }

    const generation = this.sessionGeneration;
    const entry: InFlightHydration = {
      userId: authUser.id,
      generation,
      navigateToPortal,
      promise: Promise.resolve({
        ok: false,
        reason: 'unmounted',
        error: 'Uninitialized hydration.',
      }),
    };

    const runHydration = async (): Promise<HydrationResult> => {
      try {
        const { profile, error } = await this.service.syncMyUserProfile();

        if (generation !== this.sessionGeneration) {
          return {
            ok: false,
            reason: 'superseded',
            error: 'Authentication state changed while verifying your session.',
          };
        }

        if (!this.isAttached) {
          return {
            ok: false,
            reason: 'unmounted',
            error: 'Portal session listener was detached.',
          };
        }

        if (error && !profile) {
          const isDeactivated = /deactivated/i.test(error);
          this.activeAuthUserId = null;
          this.activeRole = 'public';
          this.callbacks.resetToPublic({ navigateHome: false });
          await this.callbacks.applyPublicSnapshot();
          return {
            ok: false,
            reason: isDeactivated ? 'inactive_profile' : 'rpc_error',
            error,
          };
        }

        if (!profile) {
          this.activeAuthUserId = null;
          this.activeRole = 'public';
          this.callbacks.resetToPublic({ navigateHome: false });
          await this.callbacks.applyPublicSnapshot();
          return {
            ok: false,
            reason: 'no_profile',
            error:
              'Your Supabase login succeeded, but no active school portal profile is linked to this account yet. Please contact the school administrator.',
          };
        }

        if (!profile.isActive) {
          this.activeAuthUserId = null;
          this.activeRole = 'public';
          this.callbacks.resetToPublic({ navigateHome: false });
          await this.callbacks.applyPublicSnapshot();
          return {
            ok: false,
            reason: 'inactive_profile',
            error: 'This account has been deactivated. Contact the school administrator.',
          };
        }

        if (profile.authUserId !== authUser.id || !isValidAuthenticatedRole(profile.role)) {
          this.activeAuthUserId = null;
          this.activeRole = 'public';
          this.callbacks.resetToPublic({ navigateHome: false });
          await this.callbacks.applyPublicSnapshot();
          return {
            ok: false,
            reason: 'invalid_role',
            error:
              'Your account role could not be verified from Supabase. Please contact the school administrator.',
          };
        }

        if (disallowRole && profile.role === disallowRole) {
          this.activeAuthUserId = null;
          this.activeRole = 'public';
          this.callbacks.resetToPublic({ navigateHome: false });
          await this.callbacks.applyPublicSnapshot();
          return {
            ok: false,
            reason: 'invalid_role',
            error:
              disallowRole === 'student'
                ? 'Students must sign in using their Student Admission Number and password.'
                : 'Please use the correct portal login method for your account category.',
          };
        }

        const snapshot = await this.service.fetchPortalSnapshot(profile.role);

        if (generation !== this.sessionGeneration) {
          return {
            ok: false,
            reason: 'superseded',
            error: 'Authentication state changed while loading portal data.',
          };
        }

        if (!this.isAttached) {
          return {
            ok: false,
            reason: 'unmounted',
            error: 'Portal session listener was detached.',
          };
        }

        const resolvedUser = buildVerifiedPortalUser(authUser, profile, snapshot);
        if (!resolvedUser || !isValidAuthenticatedRole(resolvedUser.role)) {
          this.activeAuthUserId = null;
          this.activeRole = 'public';
          this.callbacks.resetToPublic({ navigateHome: false });
          await this.callbacks.applyPublicSnapshot();
          return {
            ok: false,
            reason: 'invalid_role',
            error: 'Unable to resolve verified portal role for this account.',
          };
        }

        this.activeAuthUserId = authUser.id;
        this.activeRole = profile.role;

        const mustChangePassword =
          profile.role === 'student'
            ? false
            : Boolean(
                profile.mustChangePassword === true ||
                  authUser.user_metadata?.must_change_password === true
              );

        this.callbacks.applyAuthenticatedSession({
          user: resolvedUser,
          profile,
          snapshot,
          navigateToPortal: entry.navigateToPortal,
          mustChangePassword,
        });

        return {
          ok: true,
          role: profile.role,
          userId: authUser.id,
        };
      } catch (err) {
        if (generation !== this.sessionGeneration) {
          return {
            ok: false,
            reason: 'superseded',
            error: 'Authentication state changed during session hydration.',
          };
        }
        const message =
          err instanceof Error ? err.message : 'Unable to verify your portal session.';
        if (this.isAttached) {
          this.activeAuthUserId = null;
          this.activeRole = 'public';
          this.callbacks.resetToPublic({ navigateHome: false });
          await this.callbacks.applyPublicSnapshot();
        }
        return {
          ok: false,
          reason: 'rpc_error',
          error: message,
        };
      } finally {
        if (this.inFlightHydration === entry) {
          this.inFlightHydration = null;
        }
      }
    };

    entry.promise = runHydration();
    this.inFlightHydration = entry;
    return entry.promise;
  }

  /**
   * Signs in with email and password, deduplicating concurrent requests and
   * verifying the user's Supabase portal role before resolving `{ ok: true }`.
   */
  async signInWithPassword(
    email: string,
    password: string
  ): Promise<{ ok: boolean; error?: string }> {
    const cleanedEmail = email.trim().toLowerCase();
    if (!cleanedEmail || !password) {
      return { ok: false, error: 'Please enter both your email address and password.' };
    }

    const attemptKey = `email:${cleanedEmail}`;
    if (this.inFlightSignIn) {
      if (this.inFlightSignIn.key === attemptKey) {
        return this.inFlightSignIn.promise;
      }
      return {
        ok: false,
        error: 'A sign-in request is already in progress. Please wait.',
      };
    }

    const loginGeneration = ++this.sessionGeneration;
    this.inFlightHydration = null;
    this.clearPendingTimers();

    const attempt: InFlightSignIn = {
      key: attemptKey,
      promise: Promise.resolve({ ok: false, error: 'Sign-in not started.' }),
    };

    const runSignIn = async (): Promise<{ ok: boolean; error?: string }> => {
      try {
        const { data, error } = await this.auth.signInWithPassword({
          email: cleanedEmail,
          password,
        });

        if (loginGeneration !== this.sessionGeneration) {
          return { ok: false, error: 'Sign-in was cancelled. Please try again.' };
        }

        if (error || !data.user) {
          return {
            ok: false,
            error: error?.message || 'Invalid email or password.',
          };
        }

        const hydrationResult = await this.hydrateSession(data.user, {
          navigateToPortal: true,
          forceRefresh: true,
          expectedGeneration: loginGeneration,
          disallowRole: 'student',
        });

        if (isHydrationFailure(hydrationResult)) {
          if (hydrationResult.reason !== 'superseded' && hydrationResult.reason !== 'unmounted') {
            await this.safeSignOutInternal();
          }
          return {
            ok: false,
            error:
              hydrationResult.error ||
              'Account is not linked to an active school portal role.',
          };
        }

        if (this.isAttached) {
          this.callbacks.setAuthLoading(false);
        }

        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error:
            err instanceof Error
              ? err.message
              : 'Unable to sign in right now. Please check your connection and try again.',
        };
      } finally {
        if (this.inFlightSignIn === attempt) {
          this.inFlightSignIn = null;
        }
      }
    };

    attempt.promise = runSignIn();
    this.inFlightSignIn = attempt;
    return attempt.promise;
  }

  /**
   * Signs in using short-lived Supabase session tokens returned by a protected
   * server-side authentication Edge Function (used for Student Admission Number login).
   * Shares the same single-flight lock so `SIGNED_IN` listener events never race or
   * supersede the verified session.
   */
  async signInWithServerSession(
    identifierKey: string,
    authenticateServerSide: () => Promise<{
      ok: boolean;
      session?: { access_token: string; refresh_token: string };
      error?: string;
    }>
  ): Promise<{ ok: boolean; error?: string }> {
    if (typeof this.auth.setSession !== 'function') {
      return {
        ok: false,
        error: 'Supabase Auth session handler is unavailable in this client.',
      };
    }

    const attemptKey = `server:${identifierKey.trim().toUpperCase()}`;
    if (this.inFlightSignIn) {
      if (this.inFlightSignIn.key === attemptKey) {
        return this.inFlightSignIn.promise;
      }
      return {
        ok: false,
        error: 'A sign-in request is already in progress. Please wait.',
      };
    }

    const loginGeneration = ++this.sessionGeneration;
    this.inFlightHydration = null;
    this.clearPendingTimers();

    const attempt: InFlightSignIn = {
      key: attemptKey,
      promise: Promise.resolve({ ok: false, error: 'Sign-in not started.' }),
    };

    const runSignIn = async (): Promise<{ ok: boolean; error?: string }> => {
      try {
        const serverResult = await authenticateServerSide();

        if (loginGeneration !== this.sessionGeneration) {
          return { ok: false, error: 'Sign-in was cancelled. Please try again.' };
        }

        if (
          !serverResult.ok ||
          !serverResult.session?.access_token ||
          !serverResult.session?.refresh_token
        ) {
          return {
            ok: false,
            error: serverResult.error || 'Invalid admission number or password.',
          };
        }

        const { data, error } = await this.auth.setSession!({
          access_token: serverResult.session.access_token,
          refresh_token: serverResult.session.refresh_token,
        });

        if (loginGeneration !== this.sessionGeneration) {
          return { ok: false, error: 'Sign-in was cancelled. Please try again.' };
        }

        const sessionUser = data.user || data.session?.user || null;
        if (error || !sessionUser) {
          return {
            ok: false,
            error: error?.message || 'Unable to establish your authenticated portal session.',
          };
        }

        const hydrationResult = await this.hydrateSession(sessionUser, {
          navigateToPortal: true,
          forceRefresh: true,
          expectedGeneration: loginGeneration,
        });

        if (isHydrationFailure(hydrationResult)) {
          if (hydrationResult.reason !== 'superseded' && hydrationResult.reason !== 'unmounted') {
            await this.safeSignOutInternal();
          }
          return {
            ok: false,
            error:
              hydrationResult.error ||
              'Student account is not linked to an active school portal profile.',
          };
        }

        if (this.isAttached) {
          this.callbacks.setAuthLoading(false);
        }

        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error:
            err instanceof Error
              ? err.message
              : 'Unable to sign in right now. Please check your connection and try again.',
        };
      } finally {
        if (this.inFlightSignIn === attempt) {
          this.inFlightSignIn = null;
        }
      }
    };

    attempt.promise = runSignIn();
    this.inFlightSignIn = attempt;
    return attempt.promise;
  }

  /**
   * Locks protected portal state immediately, signs out of Supabase Auth (with
   * fail-closed local token cleanup if offline/network fails), invalidates any
   * in-flight hydration, and reloads the public website snapshot.
   */
  async logout(options?: { localOnly?: boolean }): Promise<void> {
    this.sessionGeneration += 1;
    this.inFlightHydration = null;
    this.activeAuthUserId = null;
    this.activeRole = 'public';
    this.clearPendingTimers();

    // Lock protected dashboards immediately before awaiting remote network sign-out
    this.callbacks.resetToPublic({ navigateHome: true });

    await this.safeSignOutInternal(Boolean(options?.localOnly));

    try {
      await this.callbacks.applyPublicSnapshot();
    } catch (err) {
      console.warn('[Auth] Unable to refresh public snapshot after logout:', err);
    }
  }
}
