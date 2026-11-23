import React, { Suspense, lazy, useState } from 'react';
import { SchoolProvider, useSchool } from './context/SchoolContext';
import { Header } from './components/common/Header';
import { Footer } from './components/common/Footer';
import { WhatsAppButton } from './components/common/WhatsAppButton';
import { PWAConnectivityAndUpdateBar } from './components/common/PWAConnectivityAndUpdateBar';
import { CheckCircle2, AlertCircle, ShieldAlert, LogOut } from 'lucide-react';
import { isPasswordValidationFailure, validatePortalPassword } from './lib/accountProvisioning';

// Keep HomePage eager for instant first-paint performance
import { HomePage } from './components/public/HomePage';

// Lazy-load secondary public pages & heavy role portals for faster mobile startup
const AboutPage = lazy(() =>
  import('./components/public/AboutPage').then((m) => ({ default: m.AboutPage }))
);
const AdmissionsPage = lazy(() =>
  import('./components/public/AdmissionsPage').then((m) => ({ default: m.AdmissionsPage }))
);
const NewsEventsPage = lazy(() =>
  import('./components/public/NewsEventsPage').then((m) => ({ default: m.NewsEventsPage }))
);
const GalleryPage = lazy(() =>
  import('./components/public/GalleryPage').then((m) => ({ default: m.GalleryPage }))
);
const ContactPage = lazy(() =>
  import('./components/public/ContactPage').then((m) => ({ default: m.ContactPage }))
);
const OnlineApplicationPage = lazy(() =>
  import('./components/public/OnlineApplicationPage').then((m) => ({
    default: m.OnlineApplicationPage,
  }))
);
const EmploymentPage = lazy(() =>
  import('./components/public/EmploymentPage').then((m) => ({ default: m.EmploymentPage }))
);

const StudentPortalLayout = lazy(() =>
  import('./components/student/StudentPortalLayout').then((m) => ({
    default: m.StudentPortalLayout,
  }))
);
const TeacherPortalLayout = lazy(() =>
  import('./components/teacher/TeacherPortalLayout').then((m) => ({
    default: m.TeacherPortalLayout,
  }))
);
const ParentPortalLayout = lazy(() =>
  import('./components/parent/ParentPortalLayout').then((m) => ({
    default: m.ParentPortalLayout,
  }))
);
const AdminPortalLayout = lazy(() =>
  import('./components/admin/AdminPortalLayout').then((m) => ({
    default: m.AdminPortalLayout,
  }))
);

const PortalViewFallback: React.FC = () => (
  <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-10 text-center space-y-3 shadow-sm">
      <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
        Loading portal module...
      </p>
    </div>
  </div>
);

const MandatoryPasswordSetupModal: React.FC = () => {
  const {
    mustChangePassword,
    activeRole,
    currentUser,
    updatePassword,
    logout,
  } = useSchool();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const isAuthenticatedUser = activeRole !== 'public' && currentUser?.role === activeRole;
  const isOpen = mustChangePassword && isAuthenticatedUser && activeRole !== 'student';

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const validation = validatePortalPassword(newPassword, { minLength: 8 });
    if (isPasswordValidationFailure(validation)) {
      setError(validation.error);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      const res = await updatePassword(newPassword);
      if (!res.ok) {
        setError(res.error || 'Could not update password.');
        return;
      }
      setSuccess('Your password has been updated securely.');
      setNewPassword('');
      setConfirmPassword('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/85 backdrop-blur-md p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-500" />
            <h3 className="font-serif font-bold text-lg text-slate-900 dark:text-white">
              Complete First-Login Password Setup
            </h3>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
          Your account was provisioned with an initial administrator-assigned password. For your
          security, please choose a personal password (at least 8 characters with uppercase,
          lowercase, and a number) before continuing to your portal.
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              New Password (min 8 chars, upper, lower &amp; number)
            </label>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Confirm New Password
            </label>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-2.5 rounded-xl transition-colors disabled:opacity-60"
          >
            {saving ? 'Updating Password...' : 'Save Personal Password & Continue'}
          </button>

          <button
            type="button"
            onClick={() => void logout()}
            className="w-full py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold flex items-center justify-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out Instead
          </button>
        </form>
      </div>
    </div>
  );
};

const MainApp: React.FC = () => {
  const { currentView, activeRole, currentUser } = useSchool();
  const verifiedRole =
    activeRole !== 'public' && currentUser?.role === activeRole ? activeRole : 'public';

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-200">
      {/* Top Header Navigation */}
      <Header />

      {/* Main Content Area */}
      <main className="flex-1">
        <Suspense fallback={<PortalViewFallback />}>
          {verifiedRole === 'student' ? (
            <StudentPortalLayout />
          ) : verifiedRole === 'teacher' ? (
            <TeacherPortalLayout />
          ) : verifiedRole === 'parent' ? (
            <ParentPortalLayout />
          ) : verifiedRole === 'admin' ? (
            <AdminPortalLayout />
          ) : (
            /* Public Website Pages */
            <>
              {currentView === 'home' && <HomePage />}
              {currentView === 'about' && <AboutPage />}
              {currentView === 'admissions' && <AdmissionsPage />}
              {currentView === 'news' && <NewsEventsPage />}
              {currentView === 'gallery' && <GalleryPage />}
              {currentView === 'contact' && <ContactPage />}
              {currentView === 'apply' && <OnlineApplicationPage />}
              {currentView === 'employment' && <EmploymentPage />}
            </>
          )}
        </Suspense>
      </main>

      {/* Footer (shown on public view) */}
      {verifiedRole === 'public' && <Footer />}

      {/* Floating WhatsApp Action Button for Public Site */}
      {verifiedRole === 'public' && <WhatsAppButton />}

      {/* CBT-Safe PWA Update & Connectivity Bar */}
      <PWAConnectivityAndUpdateBar />

      <MandatoryPasswordSetupModal />
    </div>
  );
};

export default function App() {
  return (
    <SchoolProvider>
      <MainApp />
    </SchoolProvider>
  );
}
