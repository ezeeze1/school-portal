import React from 'react';
import { useSchool } from '../../context/SchoolContext';
import { CheckCircle2, XCircle, Clock, FileText, Search } from 'lucide-react';

export const ApplicationsManager: React.FC = () => {
  const { applications, updateApplicationStatus } = useSchool();

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-md">
        <h2 className="font-serif font-bold text-2xl text-slate-900 dark:text-white">
          Online Admission Applications Desk
        </h2>
        <p className="text-xs text-slate-500">Review prospective candidate submissions, approve entrance CBT permits, or decline applications.</p>
      </div>

      {/* Applications Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-900 text-white font-semibold">
              <th className="p-3">Ref ID</th>
              <th className="p-3">Applicant Candidate</th>
              <th className="p-3">Previous School</th>
              <th className="p-3">Class Seeking</th>
              <th className="p-3">Guardian Contact</th>
              <th className="p-3">Submission Date</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {applications.map((app) => (
              <tr key={app.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="p-3 font-mono font-bold text-amber-600">{app.applicationNumber}</td>
                <td className="p-3 font-bold text-slate-900 dark:text-white">
                  {app.applicantFirstName} {app.applicantLastName} ({app.gender})
                </td>
                <td className="p-3 text-slate-600 dark:text-slate-300 font-medium">
                  {app.previousSchool || 'N/A'}
                </td>
                <td className="p-3 font-semibold text-slate-700 dark:text-slate-300">{app.appliedClass}</td>
                <td className="p-3 text-slate-600 dark:text-slate-400">
                  <p className="font-bold text-slate-900 dark:text-white">{app.guardianName}</p>
                  <p className="text-[11px]">{app.guardianPhone} | {app.guardianEmail}</p>
                </td>
                <td className="p-3 text-slate-500">{app.submissionDate}</td>
                <td className="p-3 text-center">
                  <span className={`px-2.5 py-0.5 rounded font-bold uppercase text-[10px] ${
                    app.status === 'Approved' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : app.status === 'Rejected' ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  }`}>
                    {app.status}
                  </span>
                </td>
                <td className="p-3 text-center flex justify-center gap-2">
                  <button
                    onClick={() => updateApplicationStatus(app.id, 'Approved', 'Cleared for entrance CBT exam')}
                    className="p-1.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold rounded hover:bg-emerald-200"
                    title="Approve Application"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => updateApplicationStatus(app.id, 'Rejected', 'Did not meet prerequisites')}
                    className="p-1.5 bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 font-bold rounded hover:bg-red-200"
                    title="Reject Application"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
};
