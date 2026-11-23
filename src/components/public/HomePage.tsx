import React from 'react';
import { useSchool } from '../../context/SchoolContext';
import {
  Award,
  BookOpen,
  Users,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Calendar,
  ChevronRight,
  GraduationCap,
  ShieldCheck,
  Globe2,
  Cpu,
  FlaskConical,
  Palette,
  Briefcase
} from 'lucide-react';

export const HomePage: React.FC = () => {
  const { setCurrentView, newsItems, galleryImages, announcements, systemSettings } = useSchool();

  return (
    <div className="space-y-16 pb-16">
      
      {/* Hero Section */}
      <section className="relative bg-slate-950 text-white overflow-hidden py-20 lg:py-28 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.15),transparent_50%)]" />
        <div className="max-w-7xl mx-auto relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          
          <div className="space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-semibold text-xs uppercase tracking-wider">
              <Sparkles className="w-4 h-4" /> {systemSettings.heroBadge || 'Admissions Open for 2025/2026 Academic Session'}
            </div>

            <h1 className="font-serif font-black text-4xl sm:text-5xl lg:text-6xl tracking-tight text-white leading-tight">
              {systemSettings.heroTitle || 'Empowering Minds, Shaping Global Leaders.'}
            </h1>

            <p className="text-slate-300 text-base sm:text-lg max-w-xl mx-auto lg:mx-0 font-light leading-relaxed">
              {systemSettings.heroSubtitle || 'Welcome to DIVINE ACADEMY SECONDARY SCHOOL — guided by our motto, "Excellent of Divine Wisdom". Providing world-class STEM education, sound ethical discipline, state-of-the-art CBT testing centers, and holistic student development.'}
            </p>

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2">
              <button
                onClick={() => setCurrentView('apply')}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold px-6 py-3.5 rounded-xl text-sm transition-all shadow-xl hover:shadow-2xl flex items-center gap-2 transform hover:-translate-y-0.5"
              >
                Apply for Admission
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => setCurrentView('student-portal')}
                className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-6 py-3.5 rounded-xl text-sm border border-slate-700 transition-all flex items-center gap-2"
              >
                <GraduationCap className="w-4 h-4 text-amber-400" />
                Access Student CBT Portal
              </button>
            </div>

            {/* Accreditations badge list */}
            <div className="pt-6 border-t border-slate-800 flex flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-2 text-slate-400 text-xs font-semibold">
              <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-emerald-400" /> WASSCE Accredited</span>
              <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-emerald-400" /> IGCSE Cambridge Center</span>
              <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-emerald-400" /> NECO &amp; BECE</span>
            </div>
          </div>

          {/* Hero Visual Collage Card */}
          <div className="relative mx-auto max-w-lg lg:max-w-none w-full">
            <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-slate-800">
              <img
                src={systemSettings.heroImage || "https://i.ibb.co/B2GJ0CSS/Divine5.jpg"}
                alt={systemSettings.schoolName || "Divine Academy Students"}
                referrerPolicy="no-referrer"
                decoding="async"
                className="w-full h-80 sm:h-96 lg:h-[440px] object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent" />

              <div className="absolute bottom-6 left-6 right-6 p-4 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-700 text-white space-y-2">
                <div className="flex items-center justify-between">
                  <span className="bg-amber-500 text-slate-950 text-[11px] font-bold px-2.5 py-0.5 rounded-md uppercase">
                    {systemSettings.heroSpotlightLabel || 'Campus Spotlight'}
                  </span>
                  <span className="text-xs text-slate-400 font-semibold">{systemSettings.heroSpotlightText || '100% UTME/WAEC Pass Rate'}</span>
                </div>
                <h3 className="font-bold text-sm sm:text-base">{systemSettings.heroImageTitle || 'Ultra-Modern Digital CBT Exam Center & Robotics Lab'}</h3>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Stats Counter Bar */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          
          <div className="space-y-1">
            <p className="font-serif font-black text-3xl sm:text-4xl text-slate-900 dark:text-white">{systemSettings.statStudentsNumber || '1,250+'}</p>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{systemSettings.statStudentsLabel || 'Active Students'}</p>
          </div>

          <div className="space-y-1">
            <p className="font-serif font-black text-3xl sm:text-4xl text-amber-500">{systemSettings.statWaecNumber || '98.4%'}</p>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{systemSettings.statWaecLabel || 'WAEC Distinction Rate'}</p>
          </div>

          <div className="space-y-1">
            <p className="font-serif font-black text-3xl sm:text-4xl text-slate-900 dark:text-white">{systemSettings.statTeachersNumber || '65+'}</p>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{systemSettings.statTeachersLabel || 'Qualified Teachers'}</p>
          </div>

          <div className="space-y-1">
            <p className="font-serif font-black text-3xl sm:text-4xl text-emerald-600">{systemSettings.statClubsNumber || '20+'}</p>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{systemSettings.statClubsLabel || 'Clubs & Sports'}</p>
          </div>

        </div>
      </section>

      {/* Featured Academic Pillars */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <span className="text-xs font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
            Comprehensive Curriculum
          </span>
          <h2 className="font-serif font-bold text-3xl sm:text-4xl text-slate-900 dark:text-white">
            Academic Streams Designed for the Future
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            We provide structured academic pathways tailored to maximize every student's innate intellectual potential.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow space-y-4">
            <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <FlaskConical className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">Science & Tech</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Advanced Physics, Chemistry, Biology, Further Mathematics, and Robotics with modern practical laboratories.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow space-y-4">
            <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Cpu className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">ICT & Digital Skills</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Computer studies, introductory Python programming, web development, data analysis, and computer-based testing.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow space-y-4">
            <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Briefcase className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">Commercial Studies</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Financial Accounting, Economics, Commerce, Business Studies, and young entrepreneurship programs.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow space-y-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Palette className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">Humanities & Arts</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Literature, Government, History, Visual Arts, Music, French Language, and debate society.
            </p>
          </div>

        </div>
      </section>

      {/* Latest News & Upcoming Events Preview */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <h2 className="font-serif font-bold text-2xl sm:text-3xl text-slate-900 dark:text-white">
              Campus News & Announcements
            </h2>
            <p className="text-xs text-slate-500">Stay informed about academic breakthroughs, sports, and key dates.</p>
          </div>

          <button
            onClick={() => setCurrentView('news')}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-amber-600 dark:text-amber-400 hover:underline"
          >
            View All News & Events
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {newsItems.slice(0, 3).map((item) => (
            <div
              key={item.id}
              onClick={() => setCurrentView('news')}
              className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-lg transition-all cursor-pointer flex flex-col"
            >
              <div className="relative h-48 overflow-hidden">
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <span className="absolute top-3 left-3 bg-slate-950/80 text-amber-400 text-[11px] font-bold px-2.5 py-1 rounded-md backdrop-blur-sm uppercase">
                  {item.category}
                </span>
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                <div className="space-y-2">
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-amber-500" /> {item.date}
                  </span>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white line-clamp-2 group-hover:text-amber-600 transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                    {item.summary}
                  </p>
                </div>

                <div className="pt-2 text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  Read Full Article <ArrowRight className="w-3 h-3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Principal Welcome Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-slate-900 text-white rounded-3xl p-8 lg:p-12 border border-slate-800 grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
          <div className="lg:col-span-1 text-center">
            <img
              src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=400"
              alt="Principal"
              className="w-40 h-40 sm:w-48 sm:h-48 rounded-full object-cover mx-auto border-4 border-amber-400 shadow-xl"
            />
            <h3 className="font-serif font-bold text-xl mt-4">Dr. Elizabeth Vance</h3>
            <p className="text-xs text-amber-400 font-semibold uppercase tracking-wider">Principal & Head of School</p>
          </div>

          <div className="lg:col-span-2 space-y-4 text-slate-300 text-sm leading-relaxed">
            <span className="text-amber-400 text-3xl font-serif">“</span>
            <p className="text-base font-light italic">
              At DIVINE ACADEMY SECONDARY SCHOOL, we believe every child possesses unique brilliance. Guided by our slogan "Excellent of Divine Wisdom", our mission is to inspire curiosity, foster digital literacy, and instill sound values that prepare our students to excel globally.
            </p>
            <p className="text-xs text-slate-400">
              With our modern CBT platform, interactive online report cards, and dedicated teaching faculty, parents are empowered to stay fully connected with their ward's academic trajectory in real time.
            </p>
          </div>
        </div>
      </section>

    </div>
  );
};
