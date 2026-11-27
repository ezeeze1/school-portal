import React, { useState, useEffect, useRef } from 'react';
import { useSchool } from '../../context/SchoolContext';
import { UserRole } from '../../types';
import { isSupabaseConfigured } from '../../lib/supabase';
import { normalizeAdmissionNumber } from '../../lib/admissionNumber';
import { useSessionTimeout } from '../common/SessionTimeoutProvider';
import {
  X,
  ArrowRight,
  ChevronDown,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  IdCard,
  Mail,
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
  const { signInWithPassword, signInStudentWithAdmissionNo } = useSchool();
  const { sessionExpiredNotice, clearSessionExpiredNotice } = useSessionTimeout();
  const [selectedRole, setSelectedRole] = useState<UserRole>(defaultRole);
  const [admissionNo, setAdmissionNo] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setAdmissionNo('');
      setEmail('');
      setPassword('');
      setShowPassword(false);
      setSelectedRole(defaultRole);
      setErrorMsg('');
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  }, [isOpen, defaultRole]);

  if (!isOpen) return null;

  const isStudentMode = selectedRole === 'student';

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;

    setErrorMsg('');

    if (!isSupabaseConfigured) {
      setErrorMsg(
        'Supabase authentication is not configured yet. Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
      );
      return;
    }

    if (!password) {
      setErrorMsg('Please enter your account password.');
      return;
    }

    if (isStudentMode) {
      const cleanAdmissionNo = normalizeAdmissionNumber(admissionNo);
      if (!cleanAdmissionNo) {
        setErrorMsg('Please enter your Student Admission Number (e.g. STD/2026/0001).');
        return;
      }

      isSubmittingRef.current = true;
      setIsSubmitting(true);
      try {
        const result = await signInStudentWithAdmissionNo(cleanAdmissionNo, password);
        if (result.ok) {
          setPassword('');
          clearSessionExpiredNotice();
          onClose();
        } else {
          setErrorMsg(result.error || 'Invalid admission number or password.');
        }
      } finally {
        isSubmittingRef.current = false;
        setIsSubmitting(false);
      }
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMsg('Please enter your valid school portal email address.');
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      const result = await signInWithPassword(cleanEmail, password);
      if (result.ok) {
        setPassword('');
        clearSessionExpiredNotice();
        onClose();
      } else {
        setErrorMsg(result.error || 'Invalid email or password.');
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
            onClick={() => {
              setPassword('');
              onClose();
            }}
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
                Sign in securely with your verified portal account
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {sessionExpiredNotice && (
            <div
              role="status"
              className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-xl flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200 font-semibold leading-relaxed"
            >
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <span>{sessionExpiredNotice}</span>
            </div>
          )}

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
                  <option value="teacher">Teacher &amp; Faculty Portal</option>
                  <option value="parent">Parent &amp; Guardian Portal</option>
                  <option value="admin">School Administrator Portal</option>
                </select>
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {isStudentMode
                  ? 'Students sign in using their official Admission Number and administrator-assigned password.'
                  : 'Your portal role is verified from your Supabase account profile upon sign-in.'}
              </p>
            </div>

            {isStudentMode ? (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Student Admission Number
                </label>
                <div className="relative">
                  <IdCard className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    disabled={isSubmitting}
                    autoComplete="username"
                    value={admissionNo}
                    onChange={(e) => {
                      setAdmissionNo(e.target.value.toUpperCase());
                      setErrorMsg('');
                    }}
                    placeholder="e.g. STD/2026/0001"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono font-bold uppercase tracking-wide focus:ring-2 focus:ring-amber-500/20 outline-none transition-all text-slate-900 dark:text-white disabled:opacity-60"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Portal Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
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
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-amber-500/20 outline-none transition-all text-slate-900 dark:text-white font-medium disabled:opacity-60"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  disabled={isSubmitting}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrorMsg('');
                  }}
                  placeholder={
                    isStudentMode
                      ? 'Enter your assigned student password'
                      : 'Enter your account password'
                  }
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-amber-500/20 outline-none transition-all text-slate-900 dark:text-white font-medium disabled:opacity-60"
                />
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-50"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
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

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Protected by Supabase Authentication &amp; Row Level Security</span>
          </div>
        </div>
      </div>
    </div>
  );
};
