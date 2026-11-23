import React, { useState } from 'react';
import { useSchool } from '../../context/SchoolContext';
import { UserRole } from '../../types';
import {
  GraduationCap,
  Menu,
  X,
  User,
  LogOut,
  Phone,
  Mail,
  Shield,
  UserCheck,
  Users,
  ChevronDown,
  Sparkles,
  Award,
  Calendar,
  BookOpen,
  FileText,
  Image,
  HelpCircle,
  Download,
  Send
} from 'lucide-react';
import { LoginModal } from '../auth/LoginModal';
import { PWAInstallButton } from './PWAInstallButton';

export const Header: React.FC = () => {
  const { currentUser, activeRole, authLoading, logout, currentView, setCurrentView, systemSettings } = useSchool();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginModalDefaultRole, setLoginModalDefaultRole] = useState<UserRole>('student');
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const navItems = [
    { id: 'home', label: 'Home' },
    { id: 'about', label: 'About Us' },
    { id: 'admissions', label: 'Admissions' },
    { id: 'news', label: 'News & Events' },
    { id: 'gallery', label: 'Gallery' },
    { id: 'employment', label: 'Employment' },
    { id: 'contact', label: 'Contact' },
  ];

  const handleNavClick = (viewId: string) => {
    setCurrentView(viewId);
    setIsMobileMenuOpen(false);
  };

  const openLoginForRole = (role: UserRole) => {
    setLoginModalDefaultRole(role);
    setIsLoginModalOpen(true);
    setIsUserMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      
      {/* Top Utility Announcement Bar */}
      <div className="bg-slate-950 text-slate-300 text-xs py-1.5 px-4 sm:px-8 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-amber-400 font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            Admissions Open for {systemSettings.currentSession} Session!
          </span>
          <span className="hidden sm:inline-flex items-center gap-1 text-slate-400">
            <Phone className="w-3 h-3" /> {systemSettings.schoolPhone || '+234 803 111 2233'}
          </span>
          <span className="hidden md:inline-flex items-center gap-1 text-slate-400">
            <Mail className="w-3 h-3" /> {systemSettings.schoolEmail || 'admissions@divineacademy.edu'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline bg-slate-800 text-slate-300 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border border-slate-700">
            Active: {systemSettings.currentSession} ({systemSettings.currentTerm})
          </span>
          <PWAInstallButton variant="mobileBar" />

          {/* Quick Portal Direct Login Chips Hidden */}
        </div>
      </div>

      {/* Main Branding & Navigation Row */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-2 sm:gap-4">
        
        {/* Brand Logo & Name */}
        <div
          onClick={() => handleNavClick('home')}
          className="flex items-center gap-2.5 sm:gap-3 cursor-pointer group min-w-0"
        >
          <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-2xl bg-slate-900 dark:bg-amber-500 text-amber-400 dark:text-slate-950 flex items-center justify-center font-serif font-black text-lg sm:text-xl shadow-lg group-hover:scale-105 transition-transform px-1 truncate select-none">
            {systemSettings.schoolLogoText || 'DA'}
          </div>
          <div className="min-w-0">
            <h1 className="font-serif font-bold text-xs sm:text-base text-slate-900 dark:text-white leading-snug tracking-tight uppercase max-w-[150px] sm:max-w-xs md:max-w-md truncate">
              {systemSettings.schoolName || 'Divine Academy Secondary School'}
            </h1>
            <p className="text-[10px] sm:text-[11px] text-amber-600 dark:text-amber-400 font-bold tracking-wide italic truncate max-w-[150px] sm:max-w-xs">
              "{systemSettings.schoolMotto || 'Excellent of Divine Wisdom'}"
            </p>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1 xl:gap-2 text-sm font-medium">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`px-3 py-2 rounded-xl transition-all ${
                currentView === item.id
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Action Buttons & User Menu */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <PWAInstallButton variant="header" />

          <button
            onClick={() => handleNavClick('apply')}
            className="hidden sm:inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 px-4 py-2 rounded-xl font-bold text-sm transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
          >
            <Send className="w-4 h-4" />
            Apply Online
          </button>

          {/* User Portal Profile Button or Login Launcher */}
          {currentUser ? (
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-2 p-1.5 pr-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700"
              >
                <img
                  src={currentUser.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100'}
                  alt={currentUser.name}
                  className="w-9 h-9 rounded-xl object-cover border border-amber-400"
                />
                <div className="text-left hidden md:block">
                  <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                    {currentUser.name}
                  </p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    {activeRole} Portal
                  </p>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>

              {/* User Dropdown */}
              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-2 z-50 animate-fade-in">
                  <div className="p-3 border-b border-slate-100 dark:border-slate-800 mb-1">
                    <p className="font-bold text-sm text-slate-900 dark:text-white">{currentUser.name}</p>
                    <p className="text-xs text-slate-500">
                      {currentUser.email ||
                        (currentUser.role === 'student' && currentUser.referenceId
                          ? `Admission No: ${currentUser.referenceId}`
                          : '')}
                    </p>
                    <span className="inline-block mt-1 text-[10px] font-bold uppercase bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-md">
                      Ref: {currentUser.referenceId || 'N/A'}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <button
                      onClick={() => {
                        handleNavClick(`${activeRole}-portal`);
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 flex items-center justify-between"
                    >
                      <span>Go to my {activeRole.toUpperCase()} Dashboard</span>
                      <ChevronDown className="w-3.5 h-3.5 -rotate-90" />
                    </button>

                    {/* Switch portal options hidden */}
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-800 mt-2 pt-1">
                    <button
                      onClick={() => {
                        logout();
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 flex items-center gap-2"
                    >
                      <LogOut className="w-3.5 h-3.5" /> Logout Session
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => openLoginForRole('student')}
              disabled={authLoading}
              className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl font-bold text-sm transition-all shadow-md flex items-center gap-2 disabled:opacity-60"
            >
              <User className="w-4 h-4 text-amber-400" />
              {authLoading ? 'Loading Session...' : 'Portal Login'}
            </button>
          )}

          {/* Mobile Menu Toggle Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>

        </div>

      </div>

      {/* Mobile Drawer Navigation */}
      {isMobileMenuOpen && (
        <div className="lg:hidden bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 pt-2 pb-6 space-y-2 animate-fade-in">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`w-full text-left px-4 py-2.5 rounded-xl font-medium text-sm ${
                currentView === item.id
                  ? 'bg-slate-100 dark:bg-slate-800 font-bold text-slate-900 dark:text-white'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {item.label}
            </button>
          ))}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2">
            <PWAInstallButton variant="mobile" />
            <button
              onClick={() => handleNavClick('apply')}
              className="w-full bg-amber-500 text-slate-950 font-bold py-2.5 rounded-xl text-sm"
            >
              Apply Online
            </button>
            {!currentUser && (
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  openLoginForRole('student');
                }}
                disabled={authLoading}
                className="w-full bg-slate-900 text-white font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <User className="w-4 h-4 text-amber-400" />
                {authLoading ? 'Loading Session...' : 'Portal Login'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Auth Login Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        defaultRole={loginModalDefaultRole}
      />

    </header>
  );
};
