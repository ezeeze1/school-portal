import React from 'react';
import { useSchool } from '../../context/SchoolContext';
import { Award, ShieldCheck, Heart, Target, Compass, Sparkles, CheckCircle2 } from 'lucide-react';

export const AboutPage: React.FC = () => {
  const { systemSettings } = useSchool();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
      
      {/* Page Title Header */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <span className="text-xs font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
          Our Heritage & Legacy
        </span>
        <h1 className="font-serif font-black text-3xl sm:text-5xl text-slate-900 dark:text-white uppercase">
          About {systemSettings.schoolName || 'DIVINE ACADEMY SECONDARY SCHOOL'}
        </h1>
        <p className="text-amber-600 dark:text-amber-400 font-serif font-bold text-lg italic">
          "{systemSettings.schoolMotto || 'Excellent of Divine Wisdom'}"
        </p>
        <p className="text-slate-600 dark:text-slate-400 text-base leading-relaxed">
          Founded with a commitment to academic distinction and moral integrity, {systemSettings.schoolName || 'DIVINE ACADEMY SECONDARY SCHOOL'} is one of the premiere co-educational secondary institutions dedicated to raising leaders of divine wisdom.
        </p>
      </div>

      {/* Vision & Mission Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-slate-900 text-white p-8 rounded-3xl border border-slate-800 space-y-4 shadow-xl">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
            <Target className="w-6 h-6" />
          </div>
          <h3 className="font-serif font-bold text-2xl text-amber-400">Our Vision</h3>
          <p className="text-slate-300 text-sm leading-relaxed font-light">
            {systemSettings.aboutVision || 'To be a world-class center of academic distinction, fostering visionary leaders equipped with cutting-edge technological competencies, unshakeable moral integrity, and global empathy.'}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-8 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-xl">
          <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Compass className="w-6 h-6" />
          </div>
          <h3 className="font-serif font-bold text-2xl text-blue-600 dark:text-blue-400">Our Mission</h3>
          <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed font-light">
            {systemSettings.aboutMission || 'To deliver an inspiring, balanced, and technology-driven secondary education through passionate educators, modern CBT platforms, robust athletic programs, and individual student care.'}
          </p>
        </div>
      </div>

      {/* Core Values */}
      <div className="space-y-8">
        <div className="text-center space-y-2">
          <h2 className="font-serif font-bold text-2xl sm:text-3xl text-slate-900 dark:text-white">
            Our Core Values
          </h2>
          <p className="text-xs text-slate-500">The pillars that guide our students and staff every day.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
            <h4 className="font-bold text-lg text-amber-600 dark:text-amber-400">1. Excellence</h4>
            <p className="text-xs text-slate-600 dark:text-slate-400">Striving for the highest quality in academics, sports, and artistic endeavors.</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
            <h4 className="font-bold text-lg text-emerald-600 dark:text-emerald-400">2. Integrity</h4>
            <p className="text-xs text-slate-600 dark:text-slate-400">Promoting honesty, ethical conduct, transparency, and personal accountability.</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
            <h4 className="font-bold text-lg text-blue-600 dark:text-blue-400">3. Innovation</h4>
            <p className="text-xs text-slate-600 dark:text-slate-400">Embracing digital technologies, CBT learning, and future-forward problem solving.</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
            <h4 className="font-bold text-lg text-purple-600 dark:text-purple-400">4. Leadership</h4>
            <p className="text-xs text-slate-600 dark:text-slate-400">Inspiring confidence, public speaking, teamwork, and responsible citizenship.</p>
          </div>
        </div>
      </div>

      {/* Leadership Board */}
      <div className="space-y-8">
        <div className="text-center space-y-2">
          <h2 className="font-serif font-bold text-2xl sm:text-3xl text-slate-900 dark:text-white">
            College Board & Executive Leadership
          </h2>
          <p className="text-xs text-slate-500">Experienced educationists and administrators guiding our institution.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-3">
            <img
              src={systemSettings.aboutPrincipalAvatar || "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=300"}
              alt="Principal"
              referrerPolicy="no-referrer"
              className="w-28 h-28 rounded-full object-cover mx-auto border-2 border-amber-400"
            />
            <div>
              <h4 className="font-bold text-lg text-slate-900 dark:text-white">{systemSettings.aboutPrincipalName || 'Dr. Elizabeth Vance'}</h4>
              <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold uppercase">{systemSettings.aboutPrincipalTitle || 'Principal & CEO'}</p>
              <p className="text-xs text-slate-500 mt-2">{systemSettings.aboutPrincipalBio || 'Ph.D. Educational Management (Oxon), M.Ed.'}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-3">
            <img
              src="https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=300"
              alt="Vice Principal Academic"
              className="w-28 h-28 rounded-full object-cover mx-auto border-2 border-amber-400"
            />
            <div>
              <h4 className="font-bold text-lg text-slate-900 dark:text-white">Mr. David Adams</h4>
              <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold uppercase">Vice Principal (Academic)</p>
              <p className="text-xs text-slate-500 mt-2">M.Sc. Mathematics, B.Ed. (Hons)</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-3">
            <img
              src="https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&q=80&w=300"
              alt="Vice Principal Administration"
              className="w-28 h-28 rounded-full object-cover mx-auto border-2 border-amber-400"
            />
            <div>
              <h4 className="font-bold text-lg text-slate-900 dark:text-white">Dr. Sarah Okonkwo</h4>
              <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold uppercase">Vice Principal (Administration)</p>
              <p className="text-xs text-slate-500 mt-2">Ph.D. Analytical Chemistry, B.Sc. Ed</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};
