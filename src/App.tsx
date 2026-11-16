import React from 'react';
import { SchoolProvider, useSchool } from './context/SchoolContext';
import { Header } from './components/common/Header';
import { Footer } from './components/common/Footer';
import { WhatsAppButton } from './components/common/WhatsAppButton';

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

const MainApp: React.FC = () => {
  const { currentView, activeRole } = useSchool();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-200">
      
      {/* Top Header Navigation */}
      <Header />

      {/* Main Content Area */}
      <main className="flex-1">
        {activeRole === 'student' ? (
          <StudentPortalLayout />
        ) : activeRole === 'teacher' ? (
          <TeacherPortalLayout />
        ) : activeRole === 'parent' ? (
          <ParentPortalLayout />
        ) : activeRole === 'admin' ? (
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
      {!activeRole && <Footer />}

      {/* Floating WhatsApp Action Button for Public Site */}
      {!activeRole && <WhatsAppButton />}

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
