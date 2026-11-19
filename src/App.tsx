import React, { useState } from 'react';
import { SchoolProvider, useSchool } from './context/SchoolContext';
import { Header } from './components/common/Header';
import { Footer } from './components/common/Footer';
import { WhatsAppButton } from './components/common/WhatsAppButton';
import { KeyRound, CheckCircle2, AlertCircle, X } from 'lucide-react';

// Public Pages
import { HomePage } from './components/public/HomePage';
import { AboutPage } from './components/public/AboutPage';
import { AdmissionsPage } from './components/public/AdmissionsPage';
import { NewsEventsPage } from './components/public/NewsEventsPage';
import { GalleryPage } from './components/public/GalleryPage';
import { ContactPage } from './components/public/ContactPage';
import { OnlineApplicationPage } from './components/public/OnlineApplicationPage';
import { EmploymentPage } from './components/public/EmploymentPage';

// Role Portals
import { StudentPortalLayout } from './components/student/StudentPortalLayout';
import { TeacherPortalLayout } from './components/teacher/TeacherPortalLayout';
import { ParentPortalLayout } from './components/parent/ParentPortalLayout';
import { AdminPortalLayout } from './components/admin/AdminPortalLayout';

const PasswordRecoveryModal: React.FC = () => {
  const { authRecoveryMode, dismissAuthRecovery, updatePassword } = useSchool();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  if (!authRecoveryMode) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
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
      setSuccess('Your password has been updated successfully.');
      setNewPassword('');
      setConfirmPassword('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-amber-500" />
            <h3 className="font-serif font-bold text-lg text-slate-900 dark:text-white">
              Set New Account Password
            </h3>
          </div>
          <button
            type="button"
            onClick={dismissAuthRecovery}
            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
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
              New Password (min 8 characters)
            </label>
            <input
              type="password"
              required
              minLength={8}
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
            {saving ? 'Updating Password...' : 'Update Password'}
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
      </main>

      {/* Footer (shown on public view) */}
      {verifiedRole === 'public' && <Footer />}

      {/* Floating WhatsApp Action Button for Public Site */}
      {verifiedRole === 'public' && <WhatsAppButton />}

      <PasswordRecoveryModal />
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
