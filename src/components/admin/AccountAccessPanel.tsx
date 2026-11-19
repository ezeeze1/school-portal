import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Mail,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserX,
  X,
} from 'lucide-react';
import {
  AccountProvisioningMode,
  AccountStatusSummary,
  PortalAccountRole,
} from '../../types';
import {
  ACCOUNT_STATUS_META,
  isProvisionValidationFailure,
  normalizeLoginEmail,
  validateProvisionRequestInput,
} from '../../lib/accountProvisioning';
import { useSchool } from '../../context/SchoolContext';

export interface AccountTargetInfo {
  role: PortalAccountRole;
  recordId: string;
  fullName: string;
  identifierLabel: string;
  identifierValue: string;
  email?: string;
  authUserId?: string;
}

export interface OneTimePasswordHandoff {
  fullName: string;
  role: PortalAccountRole;
  email: string;
  temporaryPassword: string;
  recoveredPartialAccount?: boolean;
}

export const AccountStatusBadge: React.FC<{
  summary: AccountStatusSummary;
  compact?: boolean;
  showHints?: boolean;
}> = ({ summary, compact = false, showHints = true }) => {
  const meta = ACCOUNT_STATUS_META[summary.status];

  return (
    <div className="inline-flex flex-wrap items-center gap-1.5">
      <span
        title={meta.description}
        className={`inline-flex items-center gap-1.5 border font-bold rounded-full whitespace-nowrap ${
          compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'
        } ${meta.badgeClass}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dotClass}`} />
        {meta.label}
      </span>

      {showHints && summary.needsRepair && (
        <span
          title="An Auth identity exists for this user but was not fully linked to their school profile. Open Create Login Account to safely complete the link."
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-800 border border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800 whitespace-nowrap"
        >
          <AlertTriangle className="w-3 h-3" /> Link incomplete
        </span>
      )}

      {showHints && summary.mustChangePassword && summary.status === 'active' && (
        <span
          title="User must set a personal password on next sign-in."
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800 whitespace-nowrap"
        >
          Password setup required
        </span>
      )}
    </div>
  );
};

export const ProvisioningServiceBanner: React.FC<{
  available: boolean | null;
  notice: string | null;
  loading: boolean;
  onRefresh: () => void;
}> = ({ available, notice, loading, onRefresh }) => {
  if (available !== false) return null;

  return (
    <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950 dark:text-amber-200">
      <div className="flex items-start gap-2.5">
        <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold">
            Server-side account provisioning Edge Function is not active yet
          </p>
          <p className="text-[11px] text-amber-900/90 dark:text-amber-300/90 leading-relaxed">
            {notice ||
              'Deploy supabase/functions/admin-account-provisioning to Supabase to enable secure creation of student, teacher, and parent login accounts without exposing service keys.'}
          </p>
        </div>
      </div>

      <button
        type="button"
        disabled={loading}
        onClick={onRefresh}
        className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[11px] flex items-center gap-1.5 whitespace-nowrap self-start sm:self-auto disabled:opacity-60"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        Re-check Service
      </button>
    </div>
  );
};

interface RegistrationAccountAccessSectionProps {
  roleLabel: string;
  loginEmail: string;
  createAccountNow: boolean;
  onToggleCreateAccountNow: (checked: boolean) => void;
  mode: AccountProvisioningMode;
  onModeChange: (mode: AccountProvisioningMode) => void;
  useCustomTempPassword: boolean;
  onToggleUseCustomTempPassword: (checked: boolean) => void;
  customTempPassword: string;
  onCustomTempPasswordChange: (value: string) => void;
  serviceAvailable: boolean | null;
}

export const RegistrationAccountAccessSection: React.FC<RegistrationAccountAccessSectionProps> = ({
  roleLabel,
  loginEmail,
  createAccountNow,
  onToggleCreateAccountNow,
  mode,
  onModeChange,
  useCustomTempPassword,
  onToggleUseCustomTempPassword,
  customTempPassword,
  onCustomTempPasswordChange,
  serviceAvailable,
}) => {
  const [showPwd, setShowPwd] = useState(false);

  return (
    <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="font-bold text-slate-900 dark:text-white text-xs">
            Account Access &amp; Supabase Authentication
          </span>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
          Status: Account not created
        </span>
      </div>

      <label className="flex items-start gap-2.5 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={createAccountNow}
          onChange={(e) => onToggleCreateAccountNow(e.target.checked)}
          className="mt-0.5 w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500 cursor-pointer"
        />
        <span className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
          <strong className="text-slate-900 dark:text-white">
            Create portal login account now
          </strong>{' '}
          — Provisions a dedicated Supabase Auth login for this {roleLabel} via the protected
          server-side provisioning function (your administrator session stays active).
        </span>
      </label>

      {createAccountNow && (
        <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-700">
          {!loginEmail.trim() && (
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-200 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>
                Enter a valid, unique login email address above to provision this account.
              </span>
            </div>
          )}

          {serviceAvailable === false && (
            <div className="p-2.5 rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800 text-[11px] text-orange-900 dark:text-orange-200 flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                The server provisioning Edge Function is currently unreachable. The school record
                will still be saved; if account creation fails, you can run{' '}
                <strong>Create Login Account</strong> once the function is deployed.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => onModeChange('invite')}
              className={`p-3 rounded-xl border text-left transition-all space-y-1 ${
                mode === 'invite'
                  ? 'border-amber-500 bg-amber-50/70 dark:bg-amber-950/40 ring-1 ring-amber-400'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white text-[11px]">
                <Send className="w-3.5 h-3.5 text-amber-500" /> Send Invitation Email
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Recommended. Emails a secure setup link so the user sets their own password.
              </p>
            </button>

            <button
              type="button"
              onClick={() => onModeChange('temporary_password')}
              className={`p-3 rounded-xl border text-left transition-all space-y-1 ${
                mode === 'temporary_password'
                  ? 'border-amber-500 bg-amber-50/70 dark:bg-amber-950/40 ring-1 ring-amber-400'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white text-[11px]">
                <KeyRound className="w-3.5 h-3.5 text-amber-500" /> Temporary Password Setup
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Generates a one-time temporary password shown once; must be changed on first login.
              </p>
            </button>
          </div>

          {mode === 'temporary_password' && (
            <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5">
              <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!useCustomTempPassword}
                  onChange={(e) => onToggleUseCustomTempPassword(!e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                />
                Auto-generate strong 14-character temporary password on the server (Recommended)
              </label>

              {useCustomTempPassword && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Custom Temporary Password (min 10 chars, upper, lower, number &amp; symbol)
                  </label>
                  <div className="relative">
                    <input
                      type={showPwd ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={customTempPassword}
                      onChange={(e) => onCustomTempPasswordChange(e.target.value)}
                      placeholder="e.g. D@v1neAcad#2026"
                      className="w-full pr-9 pl-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd((v) => !v)}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                      title={showPwd ? 'Hide password' : 'Show password'}
                    >
                      {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <p className="text-[10px] text-slate-500 dark:text-slate-400 flex items-start gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
            <span>
              Passwords are stored exclusively in Supabase Authentication and are never written to
              student, teacher, parent, or browser storage tables.
            </span>
          </p>
        </div>
      )}
    </div>
  );
};

interface AccountProvisioningModalProps {
  target: AccountTargetInfo | null;
  summary: AccountStatusSummary | null;
  initialHandoff?: OneTimePasswordHandoff | null;
  onClose: () => void;
  onSuccessMessage?: (msg: string) => void;
}

export const AccountProvisioningModal: React.FC<AccountProvisioningModalProps> = ({
  target,
  summary,
  initialHandoff = null,
  onClose,
  onSuccessMessage,
}) => {
  const {
    students,
    teachers,
    parents,
    provisionPortalAccount,
    resendAccountInvite,
    sendAdminPasswordReset,
    setPortalAccountEnabled,
    provisioningServiceAvailable,
  } = useSchool();

  const [email, setEmail] = useState('');
  const [mode, setMode] = useState<AccountProvisioningMode>('invite');
  const [useCustomTempPassword, setUseCustomTempPassword] = useState(false);
  const [customTempPassword, setCustomTempPassword] = useState('');
  const [showCustomPwd, setShowCustomPwd] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [handoff, setHandoff] = useState<OneTimePasswordHandoff | null>(initialHandoff);
  const [copiedHandoff, setCopiedHandoff] = useState(false);

  useEffect(() => {
    setHandoff(initialHandoff);
    setCopiedHandoff(false);
  }, [initialHandoff]);

  useEffect(() => {
    if (target) {
      setEmail(normalizeLoginEmail(summary?.email || target.email));
      setMode('invite');
      setUseCustomTempPassword(false);
      setCustomTempPassword('');
      setShowCustomPwd(false);
      setActionError(null);
      setActionSuccess(null);
    }
  }, [target, summary?.email]);

  if (!target && !handoff) return null;

  const handleCloseCleanly = () => {
    // Immediately wipe any one-time temporary password from component state
    setHandoff(null);
    setCustomTempPassword('');
    setActionError(null);
    setActionSuccess(null);
    onClose();
  };

  const handleCopyHandoff = async () => {
    if (!handoff) return;
    const text = [
      `Divine Academy Secondary School Portal Login`,
      `Name: ${handoff.fullName}`,
      `Portal Role: ${handoff.role.toUpperCase()}`,
      `Login Email: ${handoff.email}`,
      `One-Time Temporary Password: ${handoff.temporaryPassword}`,
      `Note: You will be required to set a personal password immediately after first sign-in.`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopiedHandoff(true);
      setTimeout(() => setCopiedHandoff(false), 2500);
    } catch {
      // Fallback ignored if clipboard blocked
    }
  };

  // One-Time Temporary Password Handoff Dialog
  if (handoff) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4">
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 sm:p-7 space-y-5 shadow-2xl">
          <div className="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-lg text-slate-900 dark:text-white">
                  Login Account Created
                </h3>
                <p className="text-[11px] text-slate-500">
                  One-time temporary password handoff for {handoff.fullName}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-2xl p-3.5 text-xs text-amber-950 dark:text-amber-200 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              <strong>Shown once only:</strong> Copy and share this temporary password securely. It
              is not stored in school records and cannot be retrieved again after you close this
              window. The user will be required to change it on first login.
            </span>
          </div>

          <div className="bg-slate-900 text-white rounded-2xl p-4 space-y-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-400">Login Email</span>
              <span className="font-mono font-semibold text-white">{handoff.email}</span>
            </div>
            <div className="border-t border-slate-800 pt-3 space-y-1">
              <span className="text-[10px] uppercase tracking-wider font-bold text-amber-400 block">
                One-Time Temporary Password
              </span>
              <p className="font-mono font-black text-lg tracking-wider text-amber-300 select-all break-all">
                {handoff.temporaryPassword}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => void handleCopyHandoff()}
              className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold text-xs flex items-center justify-center gap-1.5"
            >
              {copiedHandoff ? (
                <>
                  <Check className="w-4 h-4 text-emerald-500" /> Copied Credentials
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" /> Copy Login Details
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleCloseCleanly}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-md"
            >
              I Have Saved It — Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!target || !summary) return null;

  const isUnprovisionedOrNeedsRepair = summary.status === 'not_created' || Boolean(summary.needsRepair);

  const handleProvisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setActionError(null);
    setActionSuccess(null);

    const validation = validateProvisionRequestInput(
      {
        role: target.role,
        recordId: target.recordId,
        email,
        mode,
        useCustomTempPassword,
        temporaryPassword: customTempPassword,
      },
      { students, teachers, parents }
    );
    if (isProvisionValidationFailure(validation)) {
      setActionError(validation.error);
      return;
    }

    setSubmitting(true);
    try {
      const res = await provisionPortalAccount({
        role: target.role,
        recordId: target.recordId,
        email: validation.normalizedEmail,
        mode: validation.mode,
        temporaryPassword: validation.temporaryPassword,
      });

      if (!res.ok) {
        setActionError(res.error || 'Could not provision login account.');
        return;
      }

      if (res.oneTimeTemporaryPassword) {
        setHandoff({
          fullName: target.fullName,
          role: target.role,
          email: res.email || validation.normalizedEmail,
          temporaryPassword: res.oneTimeTemporaryPassword,
          recoveredPartialAccount: res.recoveredPartialAccount,
        });
        setCustomTempPassword('');
        onSuccessMessage?.(
          `Login account created for ${target.fullName} with a one-time temporary password.`
        );
        return;
      }

      const msg =
        res.message ||
        `Invitation email sent to ${res.email || validation.normalizedEmail} for ${target.fullName}.`;
      setActionSuccess(msg);
      onSuccessMessage?.(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendInvite = async () => {
    if (submitting) return;
    setActionError(null);
    setActionSuccess(null);
    setSubmitting(true);
    try {
      const res = await resendAccountInvite(target.role, target.recordId);
      if (!res.ok) {
        setActionError(res.error || 'Could not resend invitation email.');
        return;
      }
      const msg = res.message || `Setup invitation re-sent to ${summary.email || target.email}.`;
      setActionSuccess(msg);
      onSuccessMessage?.(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendPasswordReset = async () => {
    if (submitting) return;
    setActionError(null);
    setActionSuccess(null);
    setSubmitting(true);
    try {
      const res = await sendAdminPasswordReset(target.role, target.recordId);
      if (!res.ok) {
        setActionError(res.error || 'Could not send password reset email.');
        return;
      }
      const msg = res.message || `Password reset email sent to ${summary.email || target.email}.`;
      setActionSuccess(msg);
      onSuccessMessage?.(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleEnabled = async (enable: boolean) => {
    if (submitting) return;
    setActionError(null);
    setActionSuccess(null);
    setSubmitting(true);
    try {
      const res = await setPortalAccountEnabled(target.role, target.recordId, enable);
      if (!res.ok) {
        setActionError(res.error || 'Could not update account status.');
        return;
      }
      const msg =
        res.message ||
        (enable
          ? `Login access reactivated for ${target.fullName}.`
          : `Login access disabled for ${target.fullName}.`);
      setActionSuccess(msg);
      onSuccessMessage?.(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 sm:p-7 space-y-4 shadow-2xl text-xs my-8">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div>
            <h3 className="font-serif font-bold text-xl text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-500" />
              {isUnprovisionedOrNeedsRepair
                ? summary.needsRepair
                  ? 'Complete Account Link'
                  : 'Create Portal Login Account'
                : 'Manage Portal Login Access'}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {target.fullName} • {target.identifierLabel}:{' '}
              <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                {target.identifierValue}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={handleCloseCleanly}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current Authoritative Status */}
        <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 p-3.5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-slate-600 dark:text-slate-400">
              Current Auth Status
            </span>
            <AccountStatusBadge summary={summary} />
          </div>
          {(summary.email || target.email) && (
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="text-slate-500">Login Email</span>
              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                {summary.email || target.email}
              </span>
            </div>
          )}
          {summary.lastSignInAt && (
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="text-slate-500">Last Sign-In</span>
              <span className="text-slate-700 dark:text-slate-300">
                {new Date(summary.lastSignInAt).toLocaleString()}
              </span>
            </div>
          )}
        </div>

        {provisioningServiceAvailable === false && (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
            <span>
              The server-side Edge Function <code>admin-account-provisioning</code> is not reachable
              on Supabase yet. Deploy it before provisioning or modifying Auth accounts.
            </span>
          </div>
        )}

        {actionError && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs font-bold text-red-600 dark:text-red-400 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{actionError}</span>
          </div>
        )}

        {actionSuccess && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {isUnprovisionedOrNeedsRepair ? (
          <form onSubmit={handleProvisionSubmit} className="space-y-4">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-amber-500" /> Approved Login Email Address *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setActionError(null);
                }}
                placeholder="e.g. user@divineacademy.edu"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Must be a valid, unique email address for this user&apos;s Supabase Authentication
                identity.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setMode('invite')}
                className={`p-3 rounded-xl border text-left transition-all space-y-1 ${
                  mode === 'invite'
                    ? 'border-amber-500 bg-amber-50/70 dark:bg-amber-950/40 ring-1 ring-amber-400'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                  <Send className="w-3.5 h-3.5 text-amber-500" /> Send Invitation Email
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Sends a Supabase setup email so the user sets their own password.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setMode('temporary_password')}
                className={`p-3 rounded-xl border text-left transition-all space-y-1 ${
                  mode === 'temporary_password'
                    ? 'border-amber-500 bg-amber-50/70 dark:bg-amber-950/40 ring-1 ring-amber-400'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                  <KeyRound className="w-3.5 h-3.5 text-amber-500" /> Temporary Password
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Creates an active login with a one-time password required to change on first
                  sign-in.
                </p>
              </button>
            </div>

            {mode === 'temporary_password' && (
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                <label className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!useCustomTempPassword}
                    onChange={(e) => setUseCustomTempPassword(!e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-amber-500"
                  />
                  Auto-generate strong temporary password on server (Recommended)
                </label>

                {useCustomTempPassword && (
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Temporary Password (min 10 chars, upper, lower, number &amp; symbol)
                    </label>
                    <div className="relative">
                      <input
                        type={showCustomPwd ? 'text' : 'password'}
                        required
                        autoComplete="new-password"
                        value={customTempPassword}
                        onChange={(e) => setCustomTempPassword(e.target.value)}
                        className="w-full pr-9 pl-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCustomPwd((v) => !v)}
                        className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                      >
                        {showCustomPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={submitting}
                onClick={handleCloseCleanly}
                className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold shadow-md flex items-center gap-1.5 disabled:opacity-60"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {submitting
                  ? 'Provisioning...'
                  : mode === 'invite'
                    ? 'Create Account & Send Invite'
                    : 'Create Account & Issue Temp Password'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Existing passwords are encrypted inside Supabase Authentication and can never be
              viewed or retrieved. Use the secure recovery actions below to help this user regain
              access or manage account status.
            </p>

            <div className="space-y-2">
              {summary.status === 'invitation_pending' && (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void handleResendInvite()}
                  className="w-full px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Resend Setup Invitation Email
                </button>
              )}

              {summary.status !== 'disabled' && (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void handleSendPasswordReset()}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold flex items-center justify-center gap-2 border border-slate-700 disabled:opacity-60"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <KeyRound className="w-4 h-4 text-amber-400" />
                  )}
                  Send Password Reset Email
                </button>
              )}

              {summary.status === 'disabled' ? (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void handleToggleEnabled(true)}
                  className="w-full px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <UserCheck className="w-4 h-4" />
                  )}
                  Reactivate Portal Login Account
                </button>
              ) : (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void handleToggleEnabled(false)}
                  className="w-full px-4 py-2.5 rounded-xl bg-red-50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-950 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 font-bold flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <UserX className="w-4 h-4" />
                  )}
                  Disable Portal Login Account
                </button>
              )}
            </div>

            <div className="pt-2 flex justify-end border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={submitting}
                onClick={handleCloseCleanly}
                className="px-5 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
