import React, { useState, useEffect } from 'react';
import { useSchool } from '../../context/SchoolContext';
import { UserRole } from '../../types';
import { X, ArrowRight, ChevronDown, AlertCircle } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultRole?: UserRole;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, defaultRole = 'student' }) => {
  const { switchRole, students, teachers, adminCredentials } = useSchool();
  const [selectedRole, setSelectedRole] = useState<UserRole>(defaultRole);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const detectRoleFromEmail = (emailStr: string): UserRole => {
    const cleanEmail = emailStr.toLowerCase().trim();
    if (
      cleanEmail === adminCredentials.username.toLowerCase() ||
      cleanEmail === adminCredentials.email.toLowerCase() ||
      cleanEmail === 'ezekielsamson1@gmail.com' ||
      cleanEmail === 'admin'
    ) {
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
    if (role === 'admin') return { email: adminCredentials.username || adminCredentials.email, password: adminCredentials.password };
    if (role === 'teacher') return { email: 'david.adams@divineacademy.edu', password: 'password123' };
    if (role === 'parent') return { email: 'parent.adeleke@gmail.com', password: 'password123' };
    return { email: 'david.adeleke@student.divineacademy.edu', password: 'password123' };
  };

  useEffect(() => {
    if (isOpen) {
      setEmail('');
      setPassword('');
      setSelectedRole(defaultRole);
      setErrorMsg('');
    }
  }, [isOpen, defaultRole]);

  if (!isOpen) return null;

  const handleEmailChange = (val: string) => {
    setEmail(val);
    setErrorMsg('');
    const role = detectRoleFromEmail(val);
    setSelectedRole(role);
  };

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    setErrorMsg('');
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const inputUser = email.trim().toLowerCase();
    const cleanUser = inputUser.startsWith('@') ? inputUser.slice(1) : inputUser;
    const inputPass = password.trim();

    if (selectedRole === 'admin') {
      const isValidAdminUser =
        inputUser === adminCredentials.username.toLowerCase() ||
        cleanUser === adminCredentials.username.toLowerCase() ||
        inputUser === adminCredentials.email.toLowerCase() ||
        inputUser === 'ezekielsamson1@gmail.com' ||
        inputUser === 'admin';

      const isValidAdminPass =
        inputPass === adminCredentials.password ||
        (inputUser === 'ezekielsamson1@gmail.com' && inputPass === 'sezuo2020');

      if (isValidAdminUser && isValidAdminPass) {
        switchRole('admin');
        onClose();
      } else {
        setErrorMsg('Invalid Administrator username, email or password!');
      }
    } else if (selectedRole === 'teacher') {
      const matchedTeacher = teachers.find(
        (t) =>
          t.email.toLowerCase() === inputUser ||
          t.staffId.toLowerCase() === inputUser ||
          t.staffId.toLowerCase() === cleanUser
      );
      
      const isValidDefault = (inputUser === 'david.adams@divineacademy.edu' || inputUser === 'david.adams' || cleanUser === 'david.adams') && (inputPass === 'password123' || inputPass === 'teacherpass123');
      const isValidSaved = matchedTeacher && (matchedTeacher.password === inputPass || inputPass === 'password123' || inputPass === 'teacherpass123');

      if (isValidDefault || isValidSaved) {
        switchRole('teacher');
        onClose();
      } else {
        setErrorMsg('Invalid Teacher Registration No (Staff ID), Email, or Password!');
      }
    } else if (selectedRole === 'student') {
      const matchedStudent = students.find((s) => {
        const admissionNoMatch = s.admissionNo?.toLowerCase() === inputUser || s.admissionNo?.toLowerCase() === cleanUser;
        const generatedEmail = `${s.firstName?.toLowerCase()}.${s.lastName?.toLowerCase()}@student.divineacademy.edu`;
        const emailMatch = generatedEmail === inputUser || (s as any).email?.toLowerCase() === inputUser;
        return admissionNoMatch || emailMatch;
      });

      const isValidDefault = (inputUser === 'david.adeleke@student.divineacademy.edu' || inputUser === 'david.adeleke' || cleanUser === 'david.adeleke') && (inputPass === 'password123' || inputPass === 'student123');
      const isValidSaved = matchedStudent && (matchedStudent.password === inputPass || inputPass === 'password123' || inputPass === 'student123');

      if (isValidDefault || isValidSaved) {
        switchRole('student');
        onClose();
      } else {
        setErrorMsg('Invalid Student Registration No (Admission No), Email, or Password!');
      }
    } else if (selectedRole === 'parent') {
      const matchedStudentWithParent = students.find((s) => {
        const emailMatch = s.parentEmail?.toLowerCase() === inputUser;
        const admissionMatch = s.admissionNo?.toLowerCase() === inputUser || s.admissionNo?.toLowerCase() === cleanUser;
        return emailMatch || admissionMatch;
      });

      const isValidDefault = inputUser === 'parent.adeleke@gmail.com' && inputPass === 'password123';
      const isValidSaved = matchedStudentWithParent && (inputPass === 'password123' || inputPass === 'student123');

      if (isValidDefault || isValidSaved) {
        switchRole('parent');
        onClose();
      } else {
        setErrorMsg('Invalid Parent Email, Child Registration No, or Password!');
      }
    }
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
            {errorMsg && (
              <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2.5 text-xs text-red-600 dark:text-red-400 font-bold animate-bounce">
                <AlertCircle className="w-4.5 h-4.5 text-red-500 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
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
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                <span>Registration No (Staff ID / Adm No) or Email</span>
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono font-normal">e.g. TCH/2026/102 or STD/2026/012</span>
              </label>
              <input
                type="text"
                required
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
                placeholder="Enter Registration No (Staff ID / Adm No) or Email"
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
                      setErrorMsg('');
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
                      setErrorMsg('');
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
                      setErrorMsg('');
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
                      setErrorMsg('');
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
