import React, { useState, useEffect, useRef } from 'react';
import { useSchool } from '../../context/SchoolContext';
import { UserRole } from '../../types';
import { isSupabaseConfigured } from '../../lib/supabase';
import {
  X,
  ArrowRight,
  ChevronDown,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Mail,
  Loader2,
  ShieldCheck,
} from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultRole?: UserRole;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  defaultRole = 'student',
}) => {
  const { signInWithPassword, sendPasswordResetEmail } = useSchool();
  const [selectedRole, setSelectedRole] = useState<UserRole>(defaultRole);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setEmail('');
      setPassword('');
      setSelectedRole(defaultRole);
      setErrorMsg('');
      setInfoMsg('');
      setIsSubmitting(false);
      isSubmittingRef.current = false;
      setIsResetMode(false);
    }
  }, [isOpen, defaultRole]);

  if (!isOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;

    setErrorMsg('');
    setInfoMsg('');

    if (!isSupabaseConfigured) {
      setErrorMsg(
        'Supabase authentication is not configured yet. Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
      );
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMsg('Please enter your valid school portal email address.');
      return;
    }

    if (!password) {
      setErrorMsg('Please enter your account password.');
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      const result = await signInWithPassword(cleanEmail, password);
      if (result.ok) {
        onClose();
      } else {
        setErrorMsg(result.error || 'Invalid email or password.');
      }
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;

    setErrorMsg('');
    setInfoMsg('');

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      const result = await sendPasswordResetEmail(email);
      if (result.ok) {
        setInfoMsg(
          'Password reset instructions have been sent to your email address. Check your inbox and spam folder.'
        );
      } else {
        setErrorMsg(result.error || 'Could not send password reset email.');
      }
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="bg-slate-950 text-white p-6 relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold text-lg font-serif">
              DA
            </div>
            <div>
              <h3 className="font-bold text-lg text-white font-serif">Divine Academy Portal</h3>
              <p className="text-xs text-slate-400">
                {isResetMode
                  ? 'Reset your Supabase account password'
                  : 'Sign in securely with your verified portal account'}
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {!isSupabaseConfigured && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300 font-semibold">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <span>
                Supabase connection is not configured. Add VITE_SUPABASE_URL and
                VITE_SUPABASE_ANON_KEY to enable portal sign-in.
              </span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-2.5 text-xs text-red-600 dark:text-red-400 font-bold">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {infoMsg && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-start gap-2.5 text-xs text-emerald-700 dark:text-emerald-300 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>{infoMsg}</span>
            </div>
          )}

          {isResetMode ? (
            <form onSubmit={handleResetSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Account Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    disabled={isSubmitting}
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setErrorMsg('');
                    }}
                    placeholder="Enter your registered email address"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-amber-500/20 outline-none transition-all text-slate-900 dark:text-white font-medium disabled:opacity-60"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-amber-500 dark:hover:bg-amber-600 dark:text-slate-950 text-white font-bold py-3 rounded-xl transition-colors text-sm flex items-center justify-center gap-2 shadow-md disabled:opacity-60"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <KeyRound className="w-4 h-4" />
                )}
                {isSubmitting ? 'Sending Reset Link...' : 'Send Password Reset Email'}
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => {
                  setIsResetMode(false);
                  setErrorMsg('');
                  setInfoMsg('');
                }}
                className="w-full text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 py-1.5 disabled:opacity-60"
              >
                Back to Portal Sign In
              </button>
            </form>
          ) : (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Portal Account Category
                </label>
                <div className="relative">
                  <select
                    value={selectedRole}
                    disabled={isSubmitting}
                    onChange={(e) => {
                      setSelectedRole(e.target.value as UserRole);
                      setErrorMsg('');
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500/20 transition-all cursor-pointer appearance-none pr-10 disabled:opacity-60"
                  >
                    <option value="student">Student Portal</option>
                    <option value="teacher">Teacher & Faculty Portal</option>
                    <option value="parent">Parent & Guardian Portal</option>
                    <option value="admin">School Administrator Portal</option>
                  </select>
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Your portal role is verified from your Supabase account profile upon sign-in.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Portal Email Address
                </label>
                <input
                  type="email"
                  required
                  disabled={isSubmitting}
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setErrorMsg('');
                  }}
                  placeholder="name@divineacademy.edu"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-amber-500/20 outline-none transition-all text-slate-900 dark:text-white font-medium disabled:opacity-60"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Password
                  </label>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => {
                      setIsResetMode(true);
                      setErrorMsg('');
                      setInfoMsg('');
                    }}
                    className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline disabled:opacity-60"
                  >
                    Forgot password?
                  </button>
                </div>
                <input
                  type="password"
                  required
                  disabled={isSubmitting}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your account password"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-amber-500/20 outline-none transition-all text-slate-900 dark:text-white font-medium disabled:opacity-60"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-amber-500 dark:hover:bg-amber-600 dark:text-slate-950 text-white font-bold py-3 rounded-xl transition-colors text-sm flex items-center justify-center gap-2 shadow-md disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Verifying Credentials...
                  </>
                ) : (
                  <>
                    Sign In to Secure Portal
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Protected by Supabase Authentication & Row Level Security</span>
          </div>
        </div>
      </div>
    </div>
  );
};
