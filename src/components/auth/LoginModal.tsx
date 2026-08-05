import React, { useState, useEffect } from 'react';
import { useSchool } from '../../context/SchoolContext';
import { UserRole } from '../../types';
import { X, ArrowRight, ChevronDown } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultRole?: UserRole;
}

const detectRoleFromEmail = (emailStr: string): UserRole => {
  const cleanEmail = emailStr.toLowerCase().trim();
  if (cleanEmail === 'ezekielsamson1@gmail.com') {
    return 'admin';
  }
  if (cleanEmail.includes('parent') || cleanEmail.includes('guardian') || cleanEmail === 'parent.adeleke@gmail.com') {
    return 'parent';
  }
  if (cleanEmail === 'david.adams@divineacademy.edu' || cleanEmail.includes('teacher') || cleanEmail.includes('staff') || cleanEmail.includes('faculty')) {
    return 'teacher';
  }
  if (cleanEmail === 'david.adeleke@student.divineacademy.edu' || cleanEmail.includes('student')) {
    return 'student';
  }
  if (cleanEmail.includes('@student.')) {
    return 'student';
  }
  if (cleanEmail.includes('@divineacademy.edu')) {
    return 'teacher';
  }
  return 'student'; // Fallback
};

const getCredentialsForRole = (role: UserRole) => {
  if (role === 'admin') return { email: 'ezekielsamson1@gmail.com', password: 'sezuo2020' };
  if (role === 'teacher') return { email: 'david.adams@divineacademy.edu', password: 'password123' };
  if (role === 'parent') return { email: 'parent.adeleke@gmail.com', password: 'password123' };
  return { email: 'david.adeleke@student.divineacademy.edu', password: 'password123' };
};

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, defaultRole = 'student' }) => {
  const { switchRole } = useSchool();
  const [selectedRole, setSelectedRole] = useState<UserRole>(defaultRole);
  
  const initialCreds = getCredentialsForRole(defaultRole as UserRole);
  const [email, setEmail] = useState(initialCreds.email);
  const [password, setPassword] = useState(initialCreds.password);

  useEffect(() => {
    if (isOpen) {
      const creds = getCredentialsForRole(defaultRole as UserRole);
      setEmail(creds.email);
      setPassword(creds.password);
      setSelectedRole(defaultRole);
    }
  }, [isOpen, defaultRole]);

  if (!isOpen) return null;

  const handleEmailChange = (val: string) => {
    setEmail(val);
    const role = detectRoleFromEmail(val);
    setSelectedRole(role);

    // Auto-update default password if standard email is fully entered and password was default
    if (val === 'ezekielsamson1@gmail.com') {
      setPassword('sezuo2020');
    } else if (
      val === 'david.adams@divineacademy.edu' ||
      val === 'david.adeleke@student.divineacademy.edu' ||
      val === 'parent.adeleke@gmail.com'
    ) {
      setPassword('password123');
    }
  };

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    const creds = getCredentialsForRole(role);
    setEmail(creds.email);
    setPassword(creds.password);
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    switchRole(selectedRole);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 overflow-hidden">
        
        {/* Header */}
        <div className="bg-slate-950 text-white p-6 relative">
          <button
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
              <p className="text-xs text-slate-400">Sign in to your secure school dashboard</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          
          {/* Login Form */}
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Select Portal Type / Account Role
              </label>
              <div className="relative">
                <select
                  value={selectedRole}
                  onChange={(e) => handleRoleSelect(e.target.value as UserRole)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500/20 transition-all cursor-pointer appearance-none pr-10"
                >
                  <option value="student">🎓 Student Portal</option>
                  <option value="teacher">👨‍🏫 Teacher & Faculty Portal</option>
                  <option value="parent">👨‍👩‍👧 Parent & Guardian Portal</option>
                  <option value="admin">🛡️ School Administrator Portal</option>
                </select>
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Portal Identifier or Email Address
              </label>
              <input
                type="text"
                required
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
                placeholder="Enter registration ID or email"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-amber-500/20 outline-none transition-all text-slate-900 dark:text-white font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your security password"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-amber-500/20 outline-none transition-all text-slate-900 dark:text-white font-medium"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-amber-500 dark:hover:bg-amber-600 dark:text-slate-950 text-white font-bold py-3 rounded-xl transition-colors text-sm flex items-center justify-center gap-2 shadow-md"
            >
              Sign In to Secure Portal
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Collapsible Developer Testing Console */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
            <details className="text-[11px] text-slate-400 dark:text-slate-500 cursor-pointer select-none">
              <summary className="hover:text-slate-600 dark:hover:text-slate-400 font-bold uppercase tracking-wider text-[10px] flex items-center justify-center gap-1">
                ⚙️ Quick-Fill Developer Demo Profiles
              </summary>
              <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 text-left">
                <p className="text-[10px] text-slate-500 leading-snug">
                  Click any credential below to pre-populate the login credentials and automatically route to the corresponding dashboard portal:
                </p>
                <div className="grid grid-cols-1 gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setEmail('ezekielsamson1@gmail.com');
                      setPassword('sezuo2020');
                      setSelectedRole('admin');
                    }}
                    className="w-full text-left p-2 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono transition-colors"
                  >
                    <span className="text-purple-600 dark:text-purple-400 font-bold font-sans text-[10px] uppercase block">Admin Account</span>
                    ezekielsamson1@gmail.com
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEmail('david.adams@divineacademy.edu');
                      setPassword('password123');
                      setSelectedRole('teacher');
                    }}
                    className="w-full text-left p-2 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono transition-colors"
                  >
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold font-sans text-[10px] uppercase block">Teacher Account</span>
                    david.adams@divineacademy.edu
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEmail('david.adeleke@student.divineacademy.edu');
                      setPassword('password123');
                      setSelectedRole('student');
                    }}
                    className="w-full text-left p-2 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono transition-colors"
                  >
                    <span className="text-blue-600 dark:text-blue-400 font-bold font-sans text-[10px] uppercase block">Student Account</span>
                    david.adeleke@student.divineacademy.edu
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEmail('parent.adeleke@gmail.com');
                      setPassword('password123');
                      setSelectedRole('parent');
                    }}
                    className="w-full text-left p-2 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono transition-colors"
                  >
                    <span className="text-amber-600 dark:text-amber-400 font-bold font-sans text-[10px] uppercase block">Parent Account</span>
                    parent.adeleke@gmail.com
                  </button>
                </div>
              </div>
            </details>
          </div>

        </div>

      </div>
    </div>
  );
};
