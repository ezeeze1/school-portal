import React, { useState, useEffect } from 'react';
import { useSchool } from '../../context/SchoolContext';
import { Award, Bell, Printer, Lock, Key, ShieldCheck, AlertCircle, Users } from 'lucide-react';
import { ReportCardModal } from '../reports/ReportCardModal';

export const ParentPortalLayout: React.FC = () => {
  const { currentUser, students, parents, results, attendance, announcements } = useSchool();
  const [activeReportModal, setActiveReportModal] = useState<any | null>(null);

  // Strictly match the currently authenticated parent without falling back to another parent
  const currentParent = currentUser
    ? parents.find(
        (p) =>
          p.id === currentUser.id ||
          (currentUser.referenceId &&
            p.parentId?.toLowerCase() === currentUser.referenceId.toLowerCase()) ||
          (currentUser.email && p.email.toLowerCase() === currentUser.email.toLowerCase()) ||
          (currentUser.name && p.fullName.toLowerCase() === currentUser.name.toLowerCase())
      )
    : undefined;

  const parentDisplayName = currentParent
    ? currentParent.title
      ? `${currentParent.title} ${currentParent.fullName}`
      : currentParent.fullName
    : currentUser?.name || 'Parent / Guardian';

  // Wards / Children strictly linked to this parent only (NEVER fall back to all school students)
  const parentEmailToMatch = (currentParent?.email || currentUser?.email || '').toLowerCase();
  const availableStudents = currentUser
    ? students.filter(
        (s) =>
          (parentEmailToMatch && s.parentEmail?.toLowerCase() === parentEmailToMatch) ||
          Boolean(currentParent?.studentIds?.includes(s.id))
      )
    : [];

  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    availableStudents[0]?.id || ''
  );

  useEffect(() => {
    if (availableStudents.length === 0) {
      if (selectedStudentId !== '') setSelectedStudentId('');
    } else if (!availableStudents.some((s) => s.id === selectedStudentId)) {
      setSelectedStudentId(availableStudents[0].id);
    }
  }, [availableStudents, selectedStudentId]);

  // Passcode protection state for parent portal (same passcode as student)
  const [unlockedStudents, setUnlockedStudents] = useState<Record<string, boolean>>({});
  const [passcodeInput, setPasscodeInput] = useState('');
  const [passcodeError, setPasscodeError] = useState(false);

  // Selected child object (strictly within availableStudents)
  const selectedStudent = availableStudents.find((s) => s.id === selectedStudentId) || availableStudents[0];

  if (!selectedStudent) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6">
        <div className="bg-slate-900 text-white rounded-3xl p-8 border border-slate-800 space-y-2 shadow-2xl">
          <span className="text-amber-400 font-bold text-xs uppercase tracking-wider">
            Parent & Guardian Portal
          </span>
          <h1 className="font-serif font-bold text-2xl sm:text-3xl">
            Welcome, {parentDisplayName}
          </h1>
          <p className="text-xs text-slate-400">
            Monitor your linked ward's academic growth, attendance logs, and report cards.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-10 text-center space-y-4 shadow-md">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 flex items-center justify-center mx-auto">
            <Users className="w-8 h-8" />
          </div>
          <h2 className="font-serif font-bold text-xl text-slate-900 dark:text-white">
            No Linked Student Wards Found
          </h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            For student privacy and data protection, only wards explicitly linked to your guardian email or parent ID are visible here. Please contact the school administration office to link your child's Admission Number to your account.
          </p>
        </div>
      </div>
    );
  }

  // Child's results
  const childResults = results.filter((r) => r.studentId === selectedStudent.id);
  const latestResult = childResults[0];

  // Passcode validation logic (same passcode assigned to student)
  const officialPasscode = (selectedStudent.resultPasscode || 'RES-8K9M2P').trim().toUpperCase();
  const isUnlocked = unlockedStudents[selectedStudent.id] || false;

  const handleVerifyPasscode = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcodeInput.trim().toUpperCase() === officialPasscode) {
      setUnlockedStudents((prev) => ({ ...prev, [selectedStudent.id]: true }));
      setPasscodeError(false);
      setPasscodeInput('');
    } else {
      setPasscodeError(true);
    }
  };

  const handleLockResult = () => {
    setUnlockedStudents((prev) => ({ ...prev, [selectedStudent.id]: false }));
  };

  // Child's attendance
  const childAttendance = attendance.filter((a) => a.studentId === selectedStudent.id);
  const presentCount = childAttendance.filter((a) => a.status === 'Present').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      
      {/* Parent Welcome & Ward Selector Ribbon */}
      <div className="bg-slate-900 text-white rounded-3xl p-8 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-2xl">
        <div className="space-y-1">
          <span className="text-amber-400 font-bold text-xs uppercase tracking-wider">
            Parent & Guardian Portal
          </span>
          <h1 className="font-serif font-bold text-2xl sm:text-3xl">
            Welcome, {parentDisplayName}
          </h1>
          <p className="text-xs text-slate-400">
            Monitor real-time academic growth, attendance logs, and school fee receipts.
          </p>
        </div>

        {/* Children Ward Switcher */}
        <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700 space-y-2">
          <span className="text-[10px] uppercase font-bold text-slate-400">Select Ward / Child to Monitor:</span>
          <div className="flex gap-2 flex-wrap">
            {availableStudents.map((std) => (
              <button
                key={std.id}
                onClick={() => {
                  setSelectedStudentId(std.id);
                  setPasscodeError(false);
                  setPasscodeInput('');
                }}
                className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
                  selectedStudentId === std.id
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                <img src={std.avatar} alt={std.firstName} className="w-5 h-5 rounded-full object-cover" />
                <span>{std.firstName} ({std.className})</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Selected Child Academic Summary Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Child Profile Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-6 shadow-md">
          <div className="text-center space-y-3 border-b border-slate-200 dark:border-slate-800 pb-6">
            <img
              src={selectedStudent.avatar}
              alt={selectedStudent.firstName}
              className="w-24 h-24 rounded-full object-cover border-4 border-amber-400 mx-auto shadow-md"
            />
            <div>
              <h3 className="font-serif font-bold text-xl text-slate-900 dark:text-white">
                {selectedStudent.firstName} {selectedStudent.lastName}
              </h3>
              <p className="text-xs text-amber-600 dark:text-amber-400 font-bold uppercase">
                {selectedStudent.className} ({selectedStudent.arm} Arm)
              </p>
              <p className="text-[11px] text-slate-500 font-mono">Admission No: {selectedStudent.admissionNo}</p>
            </div>
          </div>

          <div className="space-y-3 text-xs text-slate-600 dark:text-slate-400">
            <p className="flex justify-between">
              <span>House:</span> <strong>{selectedStudent.house} House</strong>
            </p>
            <p className="flex justify-between">
              <span>Gender:</span> <strong>{selectedStudent.gender}</strong>
            </p>
            <p className="flex justify-between">
              <span>Form Teacher:</span> <strong>Dr. (Mrs.) Victoria Adebayo</strong>
            </p>
            <p className="flex justify-between">
              <span>Academic Status:</span> <strong className="text-emerald-600">{selectedStudent.status}</strong>
            </p>
          </div>
        </div>

        {/* Results & Performance Panel */}
        <div className="lg:col-span-2 space-y-6">
          
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-md">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-serif font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-500" /> Academic Results & Terminal Broadsheet
                </h3>
                <p className="text-[11px] text-slate-500">Protected by official student result access passcode.</p>
              </div>

              {isUnlocked && latestResult && (
                <button
                  onClick={() => setActiveReportModal(latestResult)}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <Printer className="w-4 h-4" /> Print Report Card
                </button>
              )}
            </div>

            {/* Passcode Gate for Parent */}
            {!isUnlocked ? (
              <div className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700/60 text-center space-y-5 my-2">
                <div className="w-14 h-14 bg-amber-100 dark:bg-amber-950/60 rounded-2xl border border-amber-300 dark:border-amber-800 flex items-center justify-center mx-auto text-amber-600 dark:text-amber-400 shadow-inner">
                  <Key className="w-7 h-7" />
                </div>

                <div className="space-y-1.5 max-w-md mx-auto">
                  <h4 className="font-serif font-bold text-xl text-slate-900 dark:text-white">
                    Result Access Passcode Required
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    To view <strong>{selectedStudent.firstName}'s</strong> terminal result and printable report card, please enter the official passcode issued by the school administration.
                  </p>
                </div>

                <form onSubmit={handleVerifyPasscode} className="space-y-3 max-w-sm mx-auto">
                  <div>
                    <input
                      type="text"
                      value={passcodeInput}
                      onChange={(e) => {
                        setPasscodeInput(e.target.value.toUpperCase());
                        setPasscodeError(false);
                      }}
                      placeholder="e.g. RES-8K9M2P"
                      className="w-full text-center tracking-widest font-mono text-base font-bold px-4 py-2.5 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:border-amber-500 uppercase placeholder:text-slate-400 placeholder:tracking-normal placeholder:font-sans placeholder:text-xs"
                      maxLength={12}
                    />

                    {passcodeError && (
                      <p className="text-xs text-red-500 font-bold mt-2 flex items-center justify-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Invalid passcode! Please verify with your ward's passcode slip.
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-2.5 px-5 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 shadow-md"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Unlock Ward's Result
                  </button>
                </form>

                  {/* Info note about missing passcode */}
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-700/60 text-center text-[10px] text-slate-400 italic">
                    Lost your passcode? Please contact the school administration or bursar.
                  </div>
                </div>
            ) : latestResult ? (
              <div className="space-y-4">
                {/* Verified Ribbon */}
                <div className="flex justify-between items-center bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800/50 text-xs">
                  <span className="text-emerald-800 dark:text-emerald-300 font-bold flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Terminal Result Access Verified
                  </span>
                  <button
                    onClick={handleLockResult}
                    className="text-slate-500 hover:text-slate-900 dark:hover:text-white font-bold flex items-center gap-1 text-[11px] bg-white dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700"
                  >
                    <Lock className="w-3 h-3" /> Lock Result
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 text-center">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Terminal Average</span>
                    <p className="font-serif font-black text-2xl text-amber-500">{latestResult.averageScore}%</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Total Score Obtained</span>
                    <p className="font-serif font-black text-2xl text-slate-900 dark:text-white">{latestResult.grandTotalScore}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Attendance</span>
                    <p className="font-bold text-emerald-600 text-lg">{latestResult.daysPresent} Days</p>
                  </div>
                </div>

                {/* Subject Broadsheet Breakdown */}
                {latestResult.scores && latestResult.scores.length > 0 && (
                  <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase text-[10px] font-bold">
                          <th className="py-2.5 px-3">Subject</th>
                          <th className="py-2.5 px-2 text-center">1st CA (20)</th>
                          <th className="py-2.5 px-2 text-center">2nd CA (20)</th>
                          <th className="py-2.5 px-2 text-center">Exam (60)</th>
                          <th className="py-2.5 px-2 text-center">Total (100)</th>
                          <th className="py-2.5 px-2 text-center">Grade</th>
                          <th className="py-2.5 px-3">Teacher Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {latestResult.scores.map((s: any) => (
                          <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                            <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">{s.subjectName}</td>
                            <td className="py-2.5 px-2 text-center">{s.ca1Score}</td>
                            <td className="py-2.5 px-2 text-center">{s.ca2Score}</td>
                            <td className="py-2.5 px-2 text-center">{s.examScore}</td>
                            <td className="py-2.5 px-2 text-center font-extrabold text-slate-900 dark:text-white">{s.totalScore}</td>
                            <td className="py-2.5 px-2 text-center">
                              <span className="px-2 py-0.5 rounded font-bold text-[11px] bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                                {s.grade}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-500 italic text-[11px]">{s.remarks}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-1 text-xs">
                  <span className="font-bold text-slate-900 dark:text-white">Form Teacher's Remark:</span>
                  <p className="italic text-slate-600 dark:text-slate-400">"{latestResult.teacherRemarks}"</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 py-4">No published terminal result available yet for this term.</p>
            )}
          </div>

          {/* School Broadcasts for Parents */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-md">
            <h3 className="font-serif font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
              <Bell className="w-5 h-5 text-amber-500" /> Notifications & Parent Bulletins
            </h3>

            <div className="space-y-3 text-xs">
              {announcements.map((ann) => (
                <div key={ann.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-1">
                  <div className="flex justify-between items-center font-bold">
                    <span className="text-slate-900 dark:text-white">{ann.title}</span>
                    <span className="text-slate-400">{ann.date}</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400">{ann.message}</p>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* Printable Report Card Modal */}
      {activeReportModal && (
        <ReportCardModal
          result={activeReportModal}
          student={selectedStudent}
          onClose={() => setActiveReportModal(null)}
        />
      )}

    </div>
  );
};

