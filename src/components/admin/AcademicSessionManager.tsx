import React, { useState, useMemo } from 'react';
import { useSchool } from '../../context/SchoolContext';
import { Settings, CheckCircle2, Save, Lock, Unlock, Globe, Info, Award, ShieldCheck, Heart, User, Image as ImageIcon, Sparkles, Key, Eye, EyeOff, UserCheck, AlertCircle, Plus, Trash2, Calendar, ArrowRight, RotateCcw } from 'lucide-react';
import { ConfirmDeleteModal } from '../common/ConfirmDeleteModal';

export const AcademicSessionManager: React.FC = () => {
  const { systemSettings, updateSystemSettings, adminCredentials, updateAdminCredentials, academicSessions, addAcademicSession, deleteAcademicSession, resetToDefaultData, activeRole, currentUser } = useSchool();
  const [showResetCacheModal, setShowResetCacheModal] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<'academic' | 'security' | 'general'>('academic');
  const [generalSection, setGeneralSection] = useState<'identity' | 'hero' | 'stats' | 'about'>('identity');

  // Admin Security & Credentials State
  const [adminName, setAdminName] = useState(adminCredentials.name || '');
  const [adminUsername, setAdminUsername] = useState(adminCredentials.username || '');
  const [adminEmail, setAdminEmail] = useState(adminCredentials.email || '');
  const [adminPassword, setAdminPassword] = useState(adminCredentials.password || '');
  const [confirmPassword, setConfirmPassword] = useState(adminCredentials.password || '');
  const [showPassword, setShowPassword] = useState(false);
  const [secError, setSecError] = useState<string | null>(null);
  const [secSuccess, setSecSuccess] = useState<string | null>(null);

  // Academic settings state
  const [session, setSession] = useState(systemSettings.currentSession);
  const [term, setTerm] = useState(systemSettings.currentTerm);
  const [isResultPublished, setIsResultPublished] = useState(systemSettings.isResultPublished);
  const [saved, setSaved] = useState(false);

  // Add New Academic Session State
  const [isAddingSession, setIsAddingSession] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [makeNewSessionActive, setMakeNewSessionActive] = useState(true);
  const [sessionAddError, setSessionAddError] = useState<string | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);

  // Consolidated list of available sessions
  const allSessions = useMemo(() => {
    const list = academicSessions || ['2026/2027', '2025/2026', '2024/2025', '2023/2024'];
    return Array.from(new Set([session, ...list]));
  }, [session, academicSessions]);

  // Suggested next sessions for quick click
  const suggestedSessions = useMemo(() => {
    const years: number[] = [];
    allSessions.forEach((s) => {
      const matches = s.match(/\b(20\d\d)\b/g);
      if (matches) {
        matches.forEach((m) => years.push(parseInt(m, 10)));
      }
    });
    const maxYear = years.length > 0 ? Math.max(...years) : 2026;
    const candidates = [
      `${maxYear}/${maxYear + 1}`,
      `${maxYear + 1}/${maxYear + 2}`,
      `${maxYear + 2}/${maxYear + 3}`,
    ];
    return candidates.filter((c) => !allSessions.includes(c));
  }, [allSessions]);

  const handleAddNewSession = () => {
    setSessionAddError(null);
    const cleaned = newSessionName.trim();
    if (!cleaned) {
      setSessionAddError('Please enter a session year range (e.g. 2026/2027).');
      return;
    }

    if (allSessions.includes(cleaned)) {
      setSessionAddError(`Session "${cleaned}" already exists in the system.`);
      return;
    }

    addAcademicSession(cleaned);
    if (makeNewSessionActive) {
      setSession(cleaned);
      updateSystemSettings({ currentSession: cleaned });
    }
    setNewSessionName('');
    setIsAddingSession(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 4000);
  };

  const handleSwitchSessionDirectly = (targetSession: string) => {
    setSession(targetSession);
    updateSystemSettings({ currentSession: targetSession });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleDeleteSessionConfirmed = () => {
    if (sessionToDelete) {
      deleteAcademicSession(sessionToDelete);
      setSessionToDelete(null);
    }
  };

  // General settings state
  const [schoolName, setSchoolName] = useState(systemSettings.schoolName || '');
  const [schoolMotto, setSchoolMotto] = useState(systemSettings.schoolMotto || '');
  const [schoolLogoText, setSchoolLogoText] = useState(systemSettings.schoolLogoText || '');
  const [schoolPhone, setSchoolPhone] = useState(systemSettings.schoolPhone || '');
  const [schoolEmail, setSchoolEmail] = useState(systemSettings.schoolEmail || '');
  const [schoolAddress, setSchoolAddress] = useState(systemSettings.schoolAddress || '');

  const [heroBadge, setHeroBadge] = useState(systemSettings.heroBadge || '');
  const [heroTitle, setHeroTitle] = useState(systemSettings.heroTitle || '');
  const [heroSubtitle, setHeroSubtitle] = useState(systemSettings.heroSubtitle || '');
  const [heroImage, setHeroImage] = useState(systemSettings.heroImage || '');
  const [heroSpotlightLabel, setHeroSpotlightLabel] = useState(systemSettings.heroSpotlightLabel || '');
  const [heroSpotlightText, setHeroSpotlightText] = useState(systemSettings.heroSpotlightText || '');
  const [heroImageTitle, setHeroImageTitle] = useState(systemSettings.heroImageTitle || '');

  const [statStudentsNumber, setStatStudentsNumber] = useState(systemSettings.statStudentsNumber || '');
  const [statStudentsLabel, setStatStudentsLabel] = useState(systemSettings.statStudentsLabel || '');
  const [statWaecNumber, setStatWaecNumber] = useState(systemSettings.statWaecNumber || '');
  const [statWaecLabel, setStatWaecLabel] = useState(systemSettings.statWaecLabel || '');
  const [statTeachersNumber, setStatTeachersNumber] = useState(systemSettings.statTeachersNumber || '');
  const [statTeachersLabel, setStatTeachersLabel] = useState(systemSettings.statTeachersLabel || '');
  const [statClubsNumber, setStatClubsNumber] = useState(systemSettings.statClubsNumber || '');
  const [statClubsLabel, setStatClubsLabel] = useState(systemSettings.statClubsLabel || '');

  const [aboutVision, setAboutVision] = useState(systemSettings.aboutVision || '');
  const [aboutMission, setAboutMission] = useState(systemSettings.aboutMission || '');
  const [aboutPrincipalName, setAboutPrincipalName] = useState(systemSettings.aboutPrincipalName || '');
  const [aboutPrincipalTitle, setAboutPrincipalTitle] = useState(systemSettings.aboutPrincipalTitle || '');
  const [aboutPrincipalAvatar, setAboutPrincipalAvatar] = useState(systemSettings.aboutPrincipalAvatar || '');
  const [aboutPrincipalBio, setAboutPrincipalBio] = useState(systemSettings.aboutPrincipalBio || '');

  const handleSaveAcademic = (e: React.FormEvent) => {
    e.preventDefault();
    updateSystemSettings({
      currentSession: session,
      currentTerm: term as any,
      isResultPublished,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleSaveAdminSecurity = (e: React.FormEvent) => {
    e.preventDefault();
    setSecError(null);
    setSecSuccess(null);

    if (!adminUsername.trim()) {
      setSecError('Admin Username / Login Identifier cannot be empty.');
      return;
    }

    if (!adminEmail.trim()) {
      setSecError('Admin Email address cannot be empty.');
      return;
    }

    if (adminPassword.length < 4) {
      setSecError('Password must be at least 4 characters long.');
      return;
    }

    if (adminPassword !== confirmPassword) {
      setSecError('New password and confirm password do not match!');
      return;
    }

    updateAdminCredentials({
      name: adminName.trim(),
      username: adminUsername.trim(),
      email: adminEmail.trim(),
      password: adminPassword.trim(),
    });

    setSecSuccess('Administrator username and password updated successfully! Your new credentials are live.');
    setTimeout(() => setSecSuccess(null), 5000);
  };

  const handleSaveGeneral = (e: React.FormEvent) => {
    e.preventDefault();
    updateSystemSettings({
      schoolName,
      schoolMotto,
      schoolLogoText,
      schoolPhone,
      schoolEmail,
      schoolAddress,
      heroBadge,
      heroTitle,
      heroSubtitle,
      heroImage,
      heroSpotlightLabel,
      heroSpotlightText,
      heroImageTitle,
      statStudentsNumber,
      statStudentsLabel,
      statWaecNumber,
      statWaecLabel,
      statTeachersNumber,
      statTeachersLabel,
      statClubsNumber,
      statClubsLabel,
      aboutVision,
      aboutMission,
      aboutPrincipalName,
      aboutPrincipalTitle,
      aboutPrincipalAvatar,
      aboutPrincipalBio,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      
      {/* Top Setting Tab Selector */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 pb-1 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveSettingsTab('academic')}
          className={`px-6 py-3 font-bold text-xs uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all flex-shrink-0 ${
            activeSettingsTab === 'academic'
              ? 'border-slate-900 dark:border-amber-500 text-slate-900 dark:text-amber-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
          }`}
        >
          <Settings className="w-4 h-4" />
          Academic & Session Settings
        </button>
        <button
          onClick={() => setActiveSettingsTab('security')}
          className={`px-6 py-3 font-bold text-xs uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all flex-shrink-0 ${
            activeSettingsTab === 'security'
              ? 'border-slate-900 dark:border-amber-500 text-slate-900 dark:text-amber-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
          }`}
        >
          <Key className="w-4 h-4" />
          Admin Security & Login Credentials
        </button>
        <button
          onClick={() => setActiveSettingsTab('general')}
          className={`px-6 py-3 font-bold text-xs uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all flex-shrink-0 ${
            activeSettingsTab === 'general'
              ? 'border-slate-900 dark:border-amber-500 text-slate-900 dark:text-amber-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
          }`}
        >
          <Globe className="w-4 h-4" />
          Website Content (General Settings)
        </button>
      </div>

      {saved && (
        <div className="bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 p-4 rounded-2xl border border-emerald-300 dark:border-emerald-800 flex items-center gap-2 text-xs font-bold animate-fade-in">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>System configuration updated successfully and applied in real time!</span>
        </div>
      )}

      {activeSettingsTab === 'academic' ? (
        <div className="space-y-6">
          <form onSubmit={handleSaveAcademic} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 space-y-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h2 className="font-serif font-bold text-xl text-slate-900 dark:text-white flex items-center gap-2">
                  <Settings className="w-5 h-5 text-amber-500" /> Academic Term & Session Control
                </h2>
                <p className="text-xs text-slate-500 mt-1">Configure active school year sessions, terms, and report card publications.</p>
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl px-3.5 py-1.5 flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>Current: {systemSettings.currentSession} ({systemSettings.currentTerm})</span>
              </div>
            </div>

            <div className="space-y-5 text-xs">
              {/* Active Academic Session Section with Add New */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-amber-500" /> Active Academic Session
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingSession(!isAddingSession);
                      setSessionAddError(null);
                    }}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {isAddingSession ? 'Close Creator' : 'Add New Session'}
                  </button>
                </div>

                {/* Inline Add New Session Panel */}
                {isAddingSession && (
                  <div className="p-5 bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/30 rounded-2xl space-y-3.5 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-sm">
                        <Plus className="w-4 h-4 text-amber-500" /> Create New Academic Session
                      </p>
                      <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400 bg-amber-200 dark:bg-amber-950/80 px-2 py-0.5 rounded">
                        New Session Entry
                      </span>
                    </div>

                    {sessionAddError && (
                      <div className="p-3 bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-200 rounded-xl text-xs font-semibold flex items-center gap-2 border border-rose-300 dark:border-rose-800">
                        <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
                        <span>{sessionAddError}</span>
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        Session Year Range <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={newSessionName}
                        onChange={(e) => {
                          setNewSessionName(e.target.value);
                          setSessionAddError(null);
                        }}
                        placeholder="e.g. 2026/2027 or 2027/2028"
                        className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold font-mono text-slate-900 dark:text-white outline-none focus:border-amber-500"
                      />

                      {/* Quick Suggestion Pills */}
                      {suggestedSessions.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[10px] text-slate-500 font-medium">Quick suggestions:</span>
                          {suggestedSessions.map((sug) => (
                            <button
                              key={sug}
                              type="button"
                              onClick={() => {
                                setNewSessionName(sug);
                                setSessionAddError(null);
                              }}
                              className="text-[10px] font-bold font-mono px-2 py-0.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-md hover:border-amber-500 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                            >
                              + {sug}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        id="makeActiveCheck"
                        checked={makeNewSessionActive}
                        onChange={(e) => setMakeNewSessionActive(e.target.checked)}
                        className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500"
                      />
                      <label htmlFor="makeActiveCheck" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                        Immediately activate this session for the school portal
                      </label>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={handleAddNewSession}
                        className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-sm"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Save & Register Session
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingSession(false);
                          setSessionAddError(null);
                        }}
                        className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold px-3 py-2 rounded-xl text-xs hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Session Select Dropdown */}
                <select
                  value={session}
                  onChange={(e) => setSession(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white"
                >
                  {allSessions.map((s) => (
                    <option key={s} value={s}>
                      {s} Session {s === systemSettings.currentSession ? '★ [Current Active]' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500">
                  Select which academic session governs current score entry, CBT exams, terminal report cards, and student records.
                </p>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-800 dark:text-slate-200">Active Academic Term</label>
                <select
                  value={term}
                  onChange={(e) => setTerm(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white"
                >
                  <option value="1st Term">1st Term</option>
                  <option value="2nd Term">2nd Term</option>
                  <option value="3rd Term">3rd Term</option>
                </select>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">Publish Terminal Results to Student & Parent Portals</p>
                  <p className="text-[11px] text-slate-500">When enabled, students and parents can view and print report cards.</p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsResultPublished(!isResultPublished)}
                  className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors ${
                    isResultPublished ? 'bg-emerald-600 text-white' : 'bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {isResultPublished ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                  {isResultPublished ? 'Results Published' : 'Results Locked'}
                </button>
              </div>

              <button
                type="submit"
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-8 py-3 rounded-xl text-xs flex items-center gap-2 transition-all shadow-md hover:shadow-lg"
              >
                <Save className="w-4 h-4" /> Save System Settings
              </button>
            </div>
          </form>

          {/* Academic Sessions Directory Management Card */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="font-serif font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-amber-500" /> Academic Sessions Directory
                </h3>
                <p className="text-xs text-slate-500">Manage all configured school years or fast-switch the active academic session.</p>
              </div>
              <span className="text-xs font-bold px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl">
                {allSessions.length} Sessions Configured
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
              {allSessions.map((s) => {
                const isActive = s === systemSettings.currentSession;
                return (
                  <div
                    key={s}
                    className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                      isActive
                        ? 'bg-amber-500/10 dark:bg-amber-500/5 border-amber-500/40 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-mono font-bold text-sm text-slate-900 dark:text-white block">
                          {s} Session
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {isActive ? 'Primary System Session' : 'Historical / Available'}
                        </span>
                      </div>
                      {isActive && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Active
                        </span>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
                      {!isActive ? (
                        <button
                          type="button"
                          onClick={() => handleSwitchSessionDirectly(s)}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-amber-500 dark:hover:bg-amber-600 text-white dark:text-slate-950 font-bold rounded-lg text-[11px] flex items-center gap-1 transition-all"
                        >
                          Make Active <ArrowRight className="w-3 h-3" />
                        </button>
                      ) : (
                        <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                          Currently Active
                        </span>
                      )}

                      {!isActive && (
                        <button
                          type="button"
                          onClick={() => setSessionToDelete(s)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                          title="Delete Session"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : activeSettingsTab === 'security' ? (
        <form onSubmit={handleSaveAdminSecurity} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 space-y-6 shadow-xl animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="font-serif font-bold text-xl text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-amber-500" /> Admin Account & Password Security
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Customize your administrator username, login email, and password at will.
              </p>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl px-4 py-2 flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400">
              <UserCheck className="w-4 h-4 flex-shrink-0" />
              <span>Active Admin: {adminCredentials.username}</span>
            </div>
          </div>

          {secError && (
            <div className="bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-200 p-4 rounded-2xl border border-rose-300 dark:border-rose-800 flex items-center gap-2 text-xs font-bold animate-shake">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600 dark:text-rose-400" />
              <span>{secError}</span>
            </div>
          )}

          {secSuccess && (
            <div className="bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 p-4 rounded-2xl border border-emerald-300 dark:border-emerald-800 flex items-center gap-2 text-xs font-bold animate-fade-in">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{secSuccess}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
            <div className="space-y-1 sm:col-span-2">
              <label className="block font-bold text-slate-700 dark:text-slate-300">
                Administrator Full Display Name *
              </label>
              <input
                type="text"
                required
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder="e.g. System Administrator, Ezekiel Samson"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-semibold text-slate-900 dark:text-white outline-none focus:border-amber-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-bold text-slate-700 dark:text-slate-300">
                Admin Username / Login ID *
              </label>
              <input
                type="text"
                required
                value={adminUsername}
                onChange={(e) => setAdminUsername(e.target.value)}
                placeholder="e.g. admin, superadmin, ezekiel"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold font-mono text-slate-900 dark:text-white outline-none focus:border-amber-500"
              />
              <p className="text-[11px] text-slate-500">You can use this username or your email address to log into the admin portal.</p>
            </div>

            <div className="space-y-1">
              <label className="block font-bold text-slate-700 dark:text-slate-300">
                Admin Email Address *
              </label>
              <input
                type="email"
                required
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="e.g. ezekielsamson1@gmail.com"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-semibold text-slate-900 dark:text-white outline-none focus:border-amber-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-bold text-slate-700 dark:text-slate-300">
                New Password *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Enter new admin password"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:border-amber-500 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="block font-bold text-slate-700 dark:text-slate-300">
                Confirm New Password *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-type new admin password"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:border-amber-500 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-[11px] text-slate-500 flex items-center gap-1">
              <Lock className="w-3.5 h-3.5 text-amber-500" /> Changes apply immediately and are stored in browser storage until Supabase Auth migration.
            </div>

            <button
              type="submit"
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-8 py-3 rounded-xl text-xs flex items-center gap-2 transition-all shadow-md hover:shadow-lg"
            >
              <Key className="w-4 h-4" /> Save Admin Credentials
            </button>
          </div>

          {activeRole === 'admin' && currentUser?.role === 'admin' && (
            <div className="mt-6 p-5 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="font-bold text-xs text-rose-900 dark:text-rose-200 flex items-center gap-1.5">
                  <RotateCcw className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  Administrator Local Cache Reset
                </p>
                <p className="text-[11px] text-rose-700/90 dark:text-rose-300/80">
                  Restores only this browser's localStorage cache to default records. Does not modify or delete any Supabase database records.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowResetCacheModal(true)}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shrink-0 shadow-sm"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset Local Cache
              </button>
            </div>
          )}
        </form>
      ) : (
        <form onSubmit={handleSaveGeneral} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 space-y-8 shadow-xl">
          <div className="flex items-center justify-between">
            <h2 className="font-serif font-bold text-xl text-slate-900 dark:text-white flex items-center gap-2">
              <Globe className="w-5 h-5 text-amber-500" /> Website Content & Layout Management
            </h2>
            <button
              type="submit"
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-6 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md"
            >
              <Save className="w-4 h-4" /> Save Content Edits
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            
            {/* Sidebar Sub-tabs */}
            <div className="flex flex-col gap-1 md:col-span-1 border-r border-slate-100 dark:border-slate-800 pr-4">
              <button
                type="button"
                onClick={() => setGeneralSection('identity')}
                className={`px-4 py-3 rounded-xl text-left font-bold text-xs flex items-center gap-2 transition-all ${
                  generalSection === 'identity'
                    ? 'bg-slate-900 dark:bg-amber-500/10 text-white dark:text-amber-400 font-extrabold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <Info className="w-4 h-4" />
                School Identity
              </button>
              <button
                type="button"
                onClick={() => setGeneralSection('hero')}
                className={`px-4 py-3 rounded-xl text-left font-bold text-xs flex items-center gap-2 transition-all ${
                  generalSection === 'hero'
                    ? 'bg-slate-900 dark:bg-amber-500/10 text-white dark:text-amber-400 font-extrabold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                Homepage Hero
              </button>
              <button
                type="button"
                onClick={() => setGeneralSection('stats')}
                className={`px-4 py-3 rounded-xl text-left font-bold text-xs flex items-center gap-2 transition-all ${
                  generalSection === 'stats'
                    ? 'bg-slate-900 dark:bg-amber-500/10 text-white dark:text-amber-400 font-extrabold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <Award className="w-4 h-4" />
                Key Achievements
              </button>
              <button
                type="button"
                onClick={() => setGeneralSection('about')}
                className={`px-4 py-3 rounded-xl text-left font-bold text-xs flex items-center gap-2 transition-all ${
                  generalSection === 'about'
                    ? 'bg-slate-900 dark:bg-amber-500/10 text-white dark:text-amber-400 font-extrabold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <User className="w-4 h-4" />
                About & Principal
              </button>
            </div>

            {/* Sub-tab Content Panels */}
            <div className="md:col-span-3 space-y-6 text-xs text-slate-700 dark:text-slate-300">
              
              {generalSection === 'identity' && (
                <div className="space-y-4 animate-fade-in">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">School Identity & Contacts</h3>
                  
                  <div>
                    <label className="block font-semibold mb-1">Official School Name</label>
                    <input
                      type="text"
                      value={schoolName}
                      onChange={(e) => setSchoolName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold mb-1">School Motto / Tagline</label>
                      <input
                        type="text"
                        value={schoolMotto}
                        onChange={(e) => setSchoolMotto(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Logo Text Abbreviation</label>
                      <input
                        type="text"
                        value={schoolLogoText}
                        onChange={(e) => setSchoolLogoText(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold mb-1">Contact Phone Number</label>
                      <input
                        type="text"
                        value={schoolPhone}
                        onChange={(e) => setSchoolPhone(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Contact Email Address</label>
                      <input
                        type="email"
                        value={schoolEmail}
                        onChange={(e) => setSchoolEmail(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">Physical School Address</label>
                    <textarea
                      value={schoolAddress}
                      onChange={(e) => setSchoolAddress(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium"
                    />
                  </div>
                </div>
              )}

              {generalSection === 'hero' && (
                <div className="space-y-4 animate-fade-in">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">Homepage Hero Visuals & Copy</h3>

                  <div>
                    <label className="block font-semibold mb-1">Hero Action Badge copy</label>
                    <input
                      type="text"
                      value={heroBadge}
                      onChange={(e) => setHeroBadge(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">Main Hero Heading Title</label>
                    <input
                      type="text"
                      value={heroTitle}
                      onChange={(e) => setHeroTitle(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">Welcome Subtitle Description</label>
                    <textarea
                      value={heroSubtitle}
                      onChange={(e) => setHeroSubtitle(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">Hero Main Banner Image URL</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={heroImage}
                        onChange={(e) => setHeroImage(e.target.value)}
                        className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => window.open(heroImage, '_blank')}
                        className="px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700"
                        title="Preview Image"
                      >
                        <ImageIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                    <p className="font-bold text-slate-900 dark:text-white text-[11px] uppercase tracking-wide">Image Spotlight Box Overlay</p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-semibold mb-1">Spotlight Pill Label</label>
                        <input
                          type="text"
                          value={heroSpotlightLabel}
                          onChange={(e) => setHeroSpotlightLabel(e.target.value)}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Spotlight Subtitle</label>
                        <input
                          type="text"
                          value={heroSpotlightText}
                          onChange={(e) => setHeroSpotlightText(e.target.value)}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold mb-1">Spotlight Main Title Headline</label>
                      <input
                        type="text"
                        value={heroImageTitle}
                        onChange={(e) => setHeroImageTitle(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium"
                      />
                    </div>
                  </div>
                </div>
              )}

              {generalSection === 'stats' && (
                <div className="space-y-4 animate-fade-in">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">School Achievements Metrics (4 counters)</h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
                      <p className="font-bold text-slate-900 dark:text-white">Metric 1</p>
                      <div>
                        <label className="block font-semibold mb-1">Big Value / Number</label>
                        <input
                          type="text"
                          value={statStudentsNumber}
                          onChange={(e) => setStatStudentsNumber(e.target.value)}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-bold"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Descriptor Label</label>
                        <input
                          type="text"
                          value={statStudentsLabel}
                          onChange={(e) => setStatStudentsLabel(e.target.value)}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium"
                        />
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
                      <p className="font-bold text-amber-500">Metric 2</p>
                      <div>
                        <label className="block font-semibold mb-1">Big Value / Number</label>
                        <input
                          type="text"
                          value={statWaecNumber}
                          onChange={(e) => setStatWaecNumber(e.target.value)}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-bold"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Descriptor Label</label>
                        <input
                          type="text"
                          value={statWaecLabel}
                          onChange={(e) => setStatWaecLabel(e.target.value)}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium"
                        />
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
                      <p className="font-bold text-slate-900 dark:text-white">Metric 3</p>
                      <div>
                        <label className="block font-semibold mb-1">Big Value / Number</label>
                        <input
                          type="text"
                          value={statTeachersNumber}
                          onChange={(e) => setStatTeachersNumber(e.target.value)}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-bold"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Descriptor Label</label>
                        <input
                          type="text"
                          value={statTeachersLabel}
                          onChange={(e) => setStatTeachersLabel(e.target.value)}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium"
                        />
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
                      <p className="font-bold text-emerald-600">Metric 4</p>
                      <div>
                        <label className="block font-semibold mb-1">Big Value / Number</label>
                        <input
                          type="text"
                          value={statClubsNumber}
                          onChange={(e) => setStatClubsNumber(e.target.value)}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-bold"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Descriptor Label</label>
                        <input
                          type="text"
                          value={statClubsLabel}
                          onChange={(e) => setStatClubsLabel(e.target.value)}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {generalSection === 'about' && (
                <div className="space-y-4 animate-fade-in">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2">About Page content & Principal Bio</h3>

                  <div>
                    <label className="block font-semibold mb-1">Vision Statement</label>
                    <textarea
                      value={aboutVision}
                      onChange={(e) => setAboutVision(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">Mission Statement</label>
                    <textarea
                      value={aboutMission}
                      onChange={(e) => setAboutMission(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium"
                    />
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4">
                    <p className="font-bold text-slate-900 dark:text-white text-[11px] uppercase tracking-wide">Principal Officer Profile</p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-semibold mb-1">Principal Name</label>
                        <input
                          type="text"
                          value={aboutPrincipalName}
                          onChange={(e) => setAboutPrincipalName(e.target.value)}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Principal Title Designation</label>
                        <input
                          type="text"
                          value={aboutPrincipalTitle}
                          onChange={(e) => setAboutPrincipalTitle(e.target.value)}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold mb-1">Principal Bio Degrees / Details</label>
                      <input
                        type="text"
                        value={aboutPrincipalBio}
                        onChange={(e) => setAboutPrincipalBio(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold mb-1">Principal Photo URL</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={aboutPrincipalAvatar}
                          onChange={(e) => setAboutPrincipalAvatar(e.target.value)}
                          className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium"
                        />
                        <button
                          type="button"
                          onClick={() => window.open(aboutPrincipalAvatar, '_blank')}
                          className="px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700"
                          title="Preview Image"
                        >
                          <ImageIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <button
                  type="submit"
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-8 py-3 rounded-xl text-xs flex items-center gap-2 transition-all shadow-md hover:shadow-lg"
                >
                  <Save className="w-4 h-4" /> Save General Settings
                </button>
              </div>

            </div>

          </div>
        </form>
      )}

      {/* Confirmation Modal for Session Deletion */}
      <ConfirmDeleteModal
        isOpen={!!sessionToDelete}
        onClose={() => setSessionToDelete(null)}
        onConfirm={handleDeleteSessionConfirmed}
        title="Confirm Academic Session Removal"
        message="Are you sure you want to delete this academic session from the system directory? Archived scores will remain unaffected, but this session will no longer appear in selectors."
        itemName={sessionToDelete ? `${sessionToDelete} Academic Session` : undefined}
      />

      {/* Confirmation Modal for Admin-Only Local Cache Reset */}
      <ConfirmDeleteModal
        isOpen={showResetCacheModal}
        onClose={() => setShowResetCacheModal(false)}
        onConfirm={() => {
          resetToDefaultData();
          setShowResetCacheModal(false);
          setSecSuccess('Local browser cache restored to default records. Supabase tables were not altered.');
          setTimeout(() => setSecSuccess(null), 5000);
        }}
        title="Reset Local Browser Cache?"
        message="This will clear only your browser's localStorage cache and restore default sample records locally. Your Supabase database records will NOT be modified or deleted."
        itemName="Local Browser Portal Cache"
      />
    </div>
  );
};
