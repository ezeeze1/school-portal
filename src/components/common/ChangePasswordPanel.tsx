import React, { useState } from 'react';
import { useSchool } from '../../context/SchoolContext';
import {
  isPasswordValidationFailure,
  validatePortalPassword,
} from '../../lib/accountProvisioning';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  ShieldCheck,
} from 'lucide-react';

interface ChangePasswordPanelProps {
  roleLabel: string;
  accountEmail?: string;
  identifierLabel?: string;
  identifierValue?: string;
}

export const ChangePasswordPanel: React.FC<ChangePasswordPanelProps> = ({
  roleLabel,
  accountEmail,
  identifierLabel,
  identifierValue,
}) => {
  const { updatePassword } = useSchool();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    const validation = validatePortalPassword(newPassword, { minLength: 8 });
    if (isPasswordValidationFailure(validation)) {
      setErrorMsg(validation.error);
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('New Password and Confirm Password do not match.');
      return;
    }

    setSaving(true);
    try {
      const res = await updatePassword(newPassword);
      if (!res.ok) {
        setErrorMsg(res.error || 'Unable to update your password right now.');
        return;
      }

      setNewPassword('');
      setConfirmPassword('');
      setSuccessMsg('Your portal password has been updated securely in Supabase Authentication.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-lg space-y-6">
        <div className="flex items-start gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="w-11 h-11 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-serif font-bold text-xl text-slate-900 dark:text-white">
              Account Security &amp; Change Password
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Update your personal {roleLabel} portal password while signed in.
            </p>
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {accountEmail && (
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Login Email
              </span>
              <span className="font-mono font-semibold text-slate-900 dark:text-white break-all">
                {accountEmail}
              </span>
            </div>
          )}
          {identifierLabel && identifierValue && (
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                {identifierLabel}
              </span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                {identifierValue}
              </span>
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs font-bold text-red-600 dark:text-red-400 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              New Password *
            </label>
            <div className="relative">
              <input
                type={showNewPwd ? 'text' : 'password'}
                required
                minLength={8}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                placeholder="At least 8 characters (uppercase, lowercase & number)"
                className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
              <button
                type="button"
                onClick={() => setShowNewPwd((v) => !v)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                title={showNewPwd ? 'Hide password' : 'Show password'}
              >
                {showNewPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Confirm New Password *
            </label>
            <div className="relative">
              <input
                type={showConfirmPwd ? 'text' : 'password'}
                required
                minLength={8}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                placeholder="Re-enter your new password"
                className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPwd((v) => !v)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                title={showConfirmPwd ? 'Hide password' : 'Show password'}
              >
                {showConfirmPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold shadow-md flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Updating Password...
              </>
            ) : (
              <>
                <KeyRound className="w-4 h-4" />
                Update My Password
              </>
            )}
          </button>
        </form>

        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-start gap-2 text-[11px] text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
          <span>
            Passwords are encrypted inside Supabase Authentication and are never stored in school
            directory tables.
          </span>
        </div>
      </div>
    </div>
  );
};
