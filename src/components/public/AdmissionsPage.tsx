import React, { useState } from 'react';
import { useSchool } from '../../context/SchoolContext';
import { CheckCircle2, Calculator, ArrowRight, HelpCircle, FileText, Send } from 'lucide-react';

export const AdmissionsPage: React.FC = () => {
  const { setCurrentView } = useSchool();
  const [selectedClassCategory, setSelectedClassCategory] = useState<'JSS' | 'SS'>('JSS');
  const [isBoarding, setIsBoarding] = useState(false);
  const [includeUniformPack, setIncludeUniformPack] = useState(true);

  // Fee calculation logic
  const baseTuition = selectedClassCategory === 'JSS' ? 300000 : 350000;
  const developmentFee = 50000;
  const ictCbtFee = 25000;
  const boardingFee = isBoarding ? 250000 : 0;
  const uniformPackFee = includeUniformPack ? 35000 : 0;

  const totalFeeEstimate = baseTuition + developmentFee + ictCbtFee + boardingFee + uniformPackFee;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
      
      {/* Title Header */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <span className="text-xs font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
          Join DIVINE ACADEMY SECONDARY SCHOOL
        </span>
        <h1 className="font-serif font-black text-3xl sm:text-5xl text-slate-900 dark:text-white">
          Admissions & Fee Structure
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-base">
          We welcome applications from motivated students into JSS 1, JSS 2, SS 1, and SS 2 for the 2025/2026 Academic Session.
        </p>
      </div>

      {/* Admission Steps */}
      <div className="bg-slate-900 text-white rounded-3xl p-8 border border-slate-800 space-y-6">
        <h2 className="font-serif font-bold text-2xl text-amber-400 text-center">
          Simple 4-Step Admission Workflow
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-slate-300">
          <div className="bg-slate-800/60 p-5 rounded-2xl border border-slate-700/60 space-y-2">
            <span className="w-8 h-8 rounded-full bg-amber-500 text-slate-950 font-bold text-sm flex items-center justify-center">1</span>
            <h4 className="font-bold text-white text-sm">Online Application</h4>
            <p className="text-xs text-slate-400">Fill out the digital application form and upload primary transcript.</p>
          </div>

          <div className="bg-slate-800/60 p-5 rounded-2xl border border-slate-700/60 space-y-2">
            <span className="w-8 h-8 rounded-full bg-amber-500 text-slate-950 font-bold text-sm flex items-center justify-center">2</span>
            <h4 className="font-bold text-white text-sm">CBT Entrance Exam</h4>
            <p className="text-xs text-slate-400">Sit for our objective entrance examination in Mathematics and English.</p>
          </div>

          <div className="bg-slate-800/60 p-5 rounded-2xl border border-slate-700/60 space-y-2">
            <span className="w-8 h-8 rounded-full bg-amber-500 text-slate-950 font-bold text-sm flex items-center justify-center">3</span>
            <h4 className="font-bold text-white text-sm">Student Interview</h4>
            <p className="text-xs text-slate-400">Brief interactive interview with parent and candidate.</p>
          </div>

          <div className="bg-slate-800/60 p-5 rounded-2xl border border-slate-700/60 space-y-2">
            <span className="w-8 h-8 rounded-full bg-amber-500 text-slate-950 font-bold text-sm flex items-center justify-center">4</span>
            <h4 className="font-bold text-white text-sm">Admission Letter</h4>
            <p className="text-xs text-slate-400">Official letter issued with student portal credentials.</p>
          </div>
        </div>

        <div className="text-center pt-2">
          <button
            onClick={() => setCurrentView('apply')}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-8 py-3 rounded-xl text-sm transition-all inline-flex items-center gap-2 shadow-lg"
          >
            Start Online Application Now <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Interactive Tuition Calculator & Fee Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Fee Options Controls */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-6 shadow-md">
          <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-xl text-slate-900 dark:text-white">Interactive Tuition & Fee Estimator</h3>
              <p className="text-xs text-slate-500">Select options to calculate exact term fee requirements.</p>
            </div>
          </div>

          {/* Level Switcher */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              1. Academic Level
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSelectedClassCategory('JSS')}
                className={`p-3 rounded-xl border text-left text-xs font-bold transition-all ${
                  selectedClassCategory === 'JSS'
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-300'
                }`}
              >
                Junior Secondary (JSS 1 - JSS 3)
              </button>
              <button
                type="button"
                onClick={() => setSelectedClassCategory('SS')}
                className={`p-3 rounded-xl border text-left text-xs font-bold transition-all ${
                  selectedClassCategory === 'SS'
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-300'
                }`}
              >
                Senior Secondary (SS 1 - SS 3)
              </button>
            </div>
          </div>

          {/* Additional Options */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              2. Additional Facilities
            </label>

            <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <input
                type="checkbox"
                checked={isBoarding}
                onChange={(e) => setIsBoarding(e.target.checked)}
                className="w-4 h-4 text-amber-500 rounded focus:ring-amber-400"
              />
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">Boarding House Residence (+₦250,000/term)</p>
                <p className="text-[11px] text-slate-500">Includes 3 meals daily, laundry, study supervision, and hostel accommodation.</p>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <input
                type="checkbox"
                checked={includeUniformPack}
                onChange={(e) => setIncludeUniformPack(e.target.checked)}
                className="w-4 h-4 text-amber-500 rounded focus:ring-amber-400"
              />
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">New Student Uniform & Sports Wear Pack (+₦35,000 one-time)</p>
                <p className="text-[11px] text-slate-500">2 day wear sets, 1 sports house wear, blazer, and tie.</p>
              </div>
            </label>
          </div>

        </div>

        {/* Calculated Receipt Card */}
        <div className="bg-slate-900 text-white p-6 rounded-3xl border border-slate-800 space-y-4 shadow-xl">
          <h4 className="font-serif font-bold text-lg text-amber-400 border-b border-slate-800 pb-3">
            Estimated Fee Breakdown
          </h4>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-slate-300">
              <span>Base Tuition Fee ({selectedClassCategory}):</span>
              <span className="font-semibold text-white">₦{baseTuition.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Development Levy:</span>
              <span className="font-semibold text-white">₦{developmentFee.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>ICT & CBT Laboratory:</span>
              <span className="font-semibold text-white">₦{ictCbtFee.toLocaleString()}</span>
            </div>
            {isBoarding && (
              <div className="flex justify-between text-slate-300">
                <span>Boarding Accommodation:</span>
                <span className="font-semibold text-amber-400">₦{boardingFee.toLocaleString()}</span>
              </div>
            )}
            {includeUniformPack && (
              <div className="flex justify-between text-slate-300">
                <span>Uniform & Starter Pack:</span>
                <span className="font-semibold text-amber-400">₦{uniformPackFee.toLocaleString()}</span>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
            <span className="font-bold text-sm text-slate-300">Total Term Fee:</span>
            <span className="font-serif font-black text-2xl text-amber-400">
              ₦{totalFeeEstimate.toLocaleString()}
            </span>
          </div>

          <p className="text-[11px] text-slate-400 italic">
            * Fees are payable per term. Flexible installment payment options available upon clearance.
          </p>

          <button
            onClick={() => setCurrentView('apply')}
            className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-3 rounded-xl text-xs transition-colors flex items-center justify-center gap-2"
          >
            Apply for Admission <Send className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>

    </div>
  );
};
