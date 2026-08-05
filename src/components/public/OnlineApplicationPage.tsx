import React, { useState } from 'react';
import { useSchool } from '../../context/SchoolContext';
import { Send, CheckCircle2, FileText, Search, User, ShieldCheck } from 'lucide-react';

export const OnlineApplicationPage: React.FC = () => {
  const { submitOnlineApplication, applications } = useSchool();
  const [step, setStep] = useState<number>(1);
  const [generatedAppNum, setGeneratedAppNum] = useState<string | null>(null);

  // Application Status Lookup Tool State
  const [lookupNum, setLookupNum] = useState('');
  const [searchedApp, setSearchedApp] = useState<any | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    applicantFirstName: '',
    applicantLastName: '',
    gender: 'Male' as 'Male' | 'Female',
    dob: '2012-05-10',
    appliedClass: 'JSS 1',
    guardianName: '',
    guardianEmail: '',
    guardianPhone: '',
    previousSchool: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const appNum = submitOnlineApplication(formData);
    setGeneratedAppNum(appNum);
    setStep(3);
  };

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    setHasSearched(true);
    const found = applications.find(
      (a) => a.applicationNumber.toLowerCase().trim() === lookupNum.toLowerCase().trim()
    );
    setSearchedApp(found || null);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      
      {/* Title */}
      <div className="text-center space-y-3">
        <span className="text-xs font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
          2025/2026 Academic Session
        </span>
        <h1 className="font-serif font-black text-3xl sm:text-4xl text-slate-900 dark:text-white">
          Online Admission Portal
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm">
          Complete the digital application form below or look up an existing application status.
        </p>
      </div>

      {/* Top Application Lookup & New Application Mode Switcher */}
      <div className="bg-slate-900 text-white p-6 rounded-3xl border border-slate-800 space-y-4">
        <h3 className="font-serif font-bold text-lg text-amber-400 flex items-center gap-2">
          <Search className="w-5 h-5" /> Already Applied? Check Application Status
        </h3>
        
        <form onSubmit={handleLookup} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            required
            value={lookupNum}
            onChange={(e) => setLookupNum(e.target.value)}
            placeholder="Enter Application Number (e.g. APP/2026/8901)"
            className="flex-1 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <button
            type="submit"
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-6 py-2.5 rounded-xl text-xs transition-colors"
          >
            Track Status
          </button>
        </form>

        {hasSearched && (
          <div className="pt-3 border-t border-slate-800">
            {searchedApp ? (
              <div className="bg-slate-800/80 p-4 rounded-xl space-y-2 border border-slate-700 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-amber-400">{searchedApp.applicationNumber}</span>
                  <span className={`px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                    searchedApp.status === 'Approved' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-amber-950 text-amber-300 border border-amber-800'
                  }`}>
                    {searchedApp.status}
                  </span>
                </div>
                <p><strong>Applicant:</strong> {searchedApp.applicantFirstName} {searchedApp.applicantLastName} ({searchedApp.appliedClass})</p>
                {searchedApp.previousSchool && <p><strong>Previous School:</strong> {searchedApp.previousSchool}</p>}
                <p><strong>Submitted:</strong> {searchedApp.submissionDate}</p>
                {searchedApp.notes && <p className="text-amber-300 italic">"{searchedApp.notes}"</p>}
              </div>
            ) : (
              <p className="text-xs text-red-400 font-medium">No application record found with that reference number.</p>
            )}
          </div>
        )}
      </div>

      {/* Main Application Form Container */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 shadow-xl">
        
        {step === 3 && generatedAppNum ? (
          <div className="text-center py-8 space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="font-serif font-bold text-2xl text-slate-900 dark:text-white">
              Application Submitted Successfully!
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto">
              Your application has been received and indexed into DIVINE ACADEMY SECONDARY SCHOOL Admissions system.
            </p>

            <div className="p-4 bg-slate-900 text-amber-400 font-mono font-bold text-lg rounded-2xl max-w-sm mx-auto border border-amber-500/30">
              Application ID: {generatedAppNum}
            </div>

            <p className="text-xs text-slate-500">
              Please keep this reference number to track your CBT entrance exam schedule.
            </p>

            <button
              onClick={() => {
                setStep(1);
                setGeneratedAppNum(null);
              }}
              className="bg-slate-900 text-white font-bold px-6 py-2.5 rounded-xl text-xs"
            >
              Submit Another Application
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Step Wizard Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <span className="font-serif font-bold text-xl text-slate-900 dark:text-white">
                New Student Registration Form
              </span>
              <span className="text-xs font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-3 py-1 rounded-full">
                Step {step} of 2
              </span>
            </div>

            {step === 1 && (
              <div className="space-y-4 animate-fade-in">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500">
                  1. Candidate Personal Details
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      First Name
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.applicantFirstName}
                      onChange={(e) => setFormData({ ...formData, applicantFirstName: e.target.value })}
                      placeholder="e.g. Chukwuma"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Last Name / Surname
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.applicantLastName}
                      onChange={(e) => setFormData({ ...formData, applicantLastName: e.target.value })}
                      placeholder="e.g. Eze"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Gender
                    </label>
                    <select
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Date of Birth
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.dob}
                      onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Target Class Seeking Admission
                    </label>
                    <select
                      value={formData.appliedClass}
                      onChange={(e) => setFormData({ ...formData, appliedClass: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                    >
                      <option value="JSS 1">JSS 1</option>
                      <option value="JSS 2">JSS 2</option>
                      <option value="SS 1">SS 1</option>
                      <option value="SS 2">SS 2</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-6 py-2.5 rounded-xl text-xs"
                  >
                    Next Step: Guardian Info →
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4 animate-fade-in">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500">
                  2. Parent / Guardian Contact & Previous School
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Guardian Full Name
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.guardianName}
                      onChange={(e) => setFormData({ ...formData, guardianName: e.target.value })}
                      placeholder="e.g. Chief Nnamdi Eze"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Guardian Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.guardianEmail}
                      onChange={(e) => setFormData({ ...formData, guardianEmail: e.target.value })}
                      placeholder="nnamdi.eze@gmail.com"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Guardian Phone Number *
                    </label>
                    <input
                      type="tel"
                      required
                      value={formData.guardianPhone}
                      onChange={(e) => setFormData({ ...formData, guardianPhone: e.target.value })}
                      placeholder="+234 803 123 4567"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Name of Previous School *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.previousSchool}
                      onChange={(e) => setFormData({ ...formData, previousSchool: e.target.value })}
                      placeholder="e.g. Corona Primary School, Gbagada"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                  </div>
                </div>

                <div className="pt-4 flex justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold px-6 py-2.5 rounded-xl text-xs"
                  >
                    ← Back
                  </button>

                  <button
                    type="submit"
                    className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-8 py-2.5 rounded-xl text-xs flex items-center gap-2"
                  >
                    Submit Official Application <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

          </form>
        )}

      </div>

    </div>
  );
};
