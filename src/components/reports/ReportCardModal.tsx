import React from 'react';
import { TerminalResult, Student } from '../../types';
import { X, Printer, Award, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';

interface ReportCardModalProps {
  result: TerminalResult;
  student: Student;
  onClose: () => void;
}

export const ReportCardModal: React.FC<ReportCardModalProps> = ({ result, student, onClose }) => {
  const handlePrint = () => {
    window.print();
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300';
      case 'B':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300';
      case 'C':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300';
      case 'D':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300';
      default:
        return 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white text-slate-900 rounded-2xl shadow-2xl max-w-4xl w-full my-8 overflow-hidden print:shadow-none print:m-0 print:p-0 print:w-full print:max-w-none">
        
        {/* Modal Action Bar (Hidden when printing) */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-lg">Terminal Report Card Viewer</h3>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors shadow-sm"
            >
              <Printer className="w-4 h-4" />
              Print / Save PDF
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Content Area */}
        <div className="p-8 space-y-6 print:p-4 print:space-y-4" id="report-card-print-area">
          
          {/* School Header */}
          <div className="border-b-2 border-slate-900 pb-6 text-center space-y-2">
            <div className="flex items-center justify-center gap-4">
              <div className="w-16 h-16 rounded-full bg-slate-900 text-amber-400 flex items-center justify-center font-serif text-2xl font-bold border-2 border-amber-400 shadow-md">
                DA
              </div>
              <div className="text-center">
                <h1 className="font-serif font-black text-2xl md:text-3xl text-slate-900 tracking-wide uppercase">
                  DIVINE ACADEMY SECONDARY SCHOOL
                </h1>
                <p className="text-xs uppercase tracking-widest text-amber-700 font-bold italic">
                  Slogan: "Excellent of Divine Wisdom"
                </p>
                <p className="text-xs text-slate-500">
                  Admiralty Way, Victoria Island, Lagos | Tel: +234 803 111 2233 | portal.divineacademy.edu
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-center">
              <span className="bg-slate-900 text-amber-300 font-bold px-6 py-1 rounded-full text-xs uppercase tracking-wider">
                Official Student Academic Performance Report - {result.sessionId} ({result.term})
              </span>
            </div>
          </div>

          {/* Student Profile Info Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm">
            <div>
              <p className="text-slate-500 text-xs font-semibold uppercase">Student Full Name</p>
              <p className="font-bold text-slate-900">{student.firstName} {student.lastName} {student.otherNames || ''}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs font-semibold uppercase">Admission No.</p>
              <p className="font-bold text-slate-900">{student.admissionNo}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs font-semibold uppercase">Class & Arm</p>
              <p className="font-bold text-slate-900">{student.className}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs font-semibold uppercase">House & Gender</p>
              <p className="font-bold text-slate-900">{student.house} House ({student.gender})</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs font-semibold uppercase">Terminal Average</p>
              <p className="font-extrabold text-slate-900 text-base">{result.averageScore}%</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs font-semibold uppercase">Total Score Obtained</p>
              <p className="font-bold text-slate-900">{result.totalObtained} / {result.totalPossible}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs font-semibold uppercase">Attendance</p>
              <p className="font-bold text-emerald-700">{result.daysPresent} / {result.totalSchoolDays} Days Present</p>
            </div>
          </div>

          {/* Subject Scores Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse border border-slate-300 text-xs md:text-sm">
              <thead>
                <tr className="bg-slate-900 text-white font-semibold">
                  <th className="p-2 border border-slate-700">Subject Name</th>
                  <th className="p-2 border border-slate-700 text-center">1st CA (20)</th>
                  <th className="p-2 border border-slate-700 text-center">2nd CA (20)</th>
                  <th className="p-2 border border-slate-700 text-center">Exam (60)</th>
                  <th className="p-2 border border-slate-700 text-center">Total (100)</th>
                  <th className="p-2 border border-slate-700 text-center">Grade</th>
                  <th className="p-2 border border-slate-700">Teacher Remarks</th>
                </tr>
              </thead>
              <tbody>
                {result.scores.map((score, idx) => (
                  <tr key={score.id || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="p-2 border border-slate-300 font-bold text-slate-900">{score.subjectName}</td>
                    <td className="p-2 border border-slate-300 text-center">{score.ca1Score}</td>
                    <td className="p-2 border border-slate-300 text-center">{score.ca2Score}</td>
                    <td className="p-2 border border-slate-300 text-center">{score.examScore}</td>
                    <td className="p-2 border border-slate-300 text-center font-extrabold text-slate-900">{score.totalScore}</td>
                    <td className="p-2 border border-slate-300 text-center">
                      <span className={`px-2 py-0.5 rounded font-bold text-xs ${getGradeColor(score.grade)}`}>
                        {score.grade}
                      </span>
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-600 italic text-xs">{score.remarks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Behavioral & Psychomotor Assessment Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            
            {/* Psychomotor Ratings */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 border-b border-slate-300 pb-2 mb-3">
                Psychomotor & Behavioral Domain Ratings (1 - 5)
              </h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                {Object.entries(result.psychomotor).map(([trait, rating]) => (
                  <div key={trait} className="flex items-center justify-between py-1 border-b border-slate-200">
                    <span className="capitalize text-slate-700 font-medium">{trait}</span>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span
                          key={star}
                          className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                            star <= (rating as number) ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-400'
                          }`}
                        >
                          {star}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Grading Scale Guide */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 border-b border-slate-300 pb-2 mb-3">
                Official Grading Key & Standards
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">A: 80 - 100</span>
                  <span className="text-slate-600">Distinction</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded">B: 70 - 79</span>
                  <span className="text-slate-600">Very Good</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded">C: 60 - 69</span>
                  <span className="text-slate-600">Credit</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="bg-orange-100 text-orange-800 font-bold px-1.5 py-0.5 rounded">D: 50 - 59</span>
                  <span className="text-slate-600">Pass</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="bg-red-100 text-red-800 font-bold px-1.5 py-0.5 rounded">F: 0 - 49</span>
                  <span className="text-slate-600">Fail</span>
                </div>
              </div>

              <div className="mt-4 p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <span>Next Academic Term Commences: <strong>{result.nextTermBegins}</strong></span>
              </div>
            </div>

          </div>

          {/* Remarks & Signatures */}
          <div className="border-t-2 border-slate-300 pt-4 space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <p className="font-bold text-slate-700 uppercase mb-1">Class Teacher's Remark:</p>
                <p className="italic text-slate-800">"{result.teacherRemarks}"</p>
                <p className="text-[10px] text-slate-500 mt-2 font-semibold">Signed: Class Form Teacher</p>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <p className="font-bold text-slate-700 uppercase mb-1">Principal's Remark & Stamp:</p>
                <p className="italic text-slate-800">"{result.principalRemarks}"</p>
                <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-200">
                  <div className="flex items-center gap-1 text-emerald-700 font-bold text-[10px]">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    VERIFIED OFFICIAL TRANSCRIPT
                  </div>
                  <span className="font-serif italic font-bold text-slate-900">Dr. Elizabeth Vance (Principal)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Security Watermark */}
          <div className="text-center pt-2 text-[10px] text-slate-400 border-t border-slate-200 flex justify-between items-center">
            <span>Report Serial: {result.id}</span>
            <span>Generated via DIVINE ACADEMY Portal</span>
            <span>Official Stamp Affixed digitally</span>
          </div>

        </div>

      </div>
    </div>
  );
};
