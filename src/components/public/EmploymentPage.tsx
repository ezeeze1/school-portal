import React, { useState } from 'react';
import { useSchool } from '../../context/SchoolContext';
import {
  Briefcase,
  GraduationCap,
  Award,
  BookOpen,
  CheckCircle2,
  Send,
  User,
  Mail,
  Phone,
  MapPin,
  Sparkles,
  FileText,
  Clock,
  ShieldCheck,
  ChevronRight,
  Heart,
  Laptop,
  Users,
  Check
} from 'lucide-react';

interface JobVacancy {
  id: string;
  title: string;
  department: string;
  type: string;
  qualification: string;
  experience: string;
  deadline: string;
  description: string;
  responsibilities: string[];
}

export const EmploymentPage: React.FC = () => {
  const { systemSettings } = useSchool();
  const [selectedJob, setSelectedJob] = useState<string>('all');
  const [submittedAppCode, setSubmittedAppCode] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    gender: 'Male',
    position: 'Mathematics Teacher',
    qualification: 'B.Ed / B.Sc + PGDE',
    courseOfStudy: '',
    trcnNumber: '',
    yearsExperience: '1-3 years',
    lastSchool: '',
    coverLetter: '',
    resumeLink: '',
  });

  const openVacancies: JobVacancy[] = [
    {
      id: 'job-1',
      title: 'Senior Mathematics & Further Maths Educator',
      department: 'Sciences & Mathematics',
      type: 'Full-Time',
      qualification: 'B.Ed Mathematics or B.Sc + PGDE',
      experience: 'Minimum 3 Years Senior Secondary Experience',
      deadline: 'Rolling Admissions',
      description: 'We are seeking an energetic and mastery-focused Mathematics teacher to deliver engaging WAEC, NECO, and JAMB prep curricula.',
      responsibilities: [
        'Prepare detailed lesson notes aligned with national curricula and CBT assessment formats',
        'Teach Senior Secondary (SS1 - SS3) Mathematics and Further Mathematics',
        'Evaluate student performance through continuous assessment tests and mock exams',
        'Integrate digital whiteboard tools and ICT into daily classroom instruction'
      ]
    },
    {
      id: 'job-2',
      title: 'English Language & Literature Instructor',
      department: 'Languages & Humanities',
      type: 'Full-Time',
      qualification: 'B.A English / B.Ed English Language',
      experience: '2+ Years Teaching Experience',
      deadline: 'Immediate Placement',
      description: 'Inspire mastery in English grammar, creative writing, oral phonetics, and African / Western literature across Junior and Senior Secondary classes.',
      responsibilities: [
        'Guide students in spoken English, diction, debating skills, and creative writing',
        'Prepare SS3 students for WAEC/NECO Literature-in-English exams',
        'Organize school drama, literary club exhibitions, and spelling bee competitions'
      ]
    },
    {
      id: 'job-3',
      title: 'Physics & Basic Technology Teacher',
      department: 'Sciences & Engineering Foundations',
      type: 'Full-Time',
      qualification: 'B.Sc Physics, Applied Physics, or Engineering + PGDE',
      experience: '2+ Years Laboratory & Classroom Experience',
      deadline: 'Rolling Admissions',
      description: 'Lead hands-on physics experiments in modern science laboratories and cultivate problem-solving technology skill sets in young minds.',
      responsibilities: [
        'Manage the physics laboratory safely and conduct weekly practical demonstrations',
        'Teach Physics concepts with real-world technological applications',
        'Supervise student science fair projects and robotics competition entries'
      ]
    },
    {
      id: 'job-4',
      title: 'Computer Science & ICT / Robotics Specialist',
      department: 'Information Technology',
      type: 'Full-Time',
      qualification: 'B.Sc Computer Science / B.Tech / HND Computer Engineering',
      experience: '1+ Year ICT Training or School Experience',
      deadline: 'Immediate Placement',
      description: 'Drive technological literacy in our state-of-the-art computer labs. Teach coding fundamentals, web design, and digital productivity tools.',
      responsibilities: [
        'Teach Junior & Senior ICT, introductory programming, and office productivity packages',
        'Assist in managing school CBT examination software systems during test periods',
        'Mentor students in digital skills and safe internet navigation practices'
      ]
    },
    {
      id: 'job-5',
      title: 'Biology & Agricultural Science Educator',
      department: 'Biological & Agricultural Sciences',
      type: 'Full-Time',
      qualification: 'B.Sc Biology / B.Agric / B.Ed Biology',
      experience: '2+ Years Secondary Teaching Experience',
      deadline: 'Rolling Admissions',
      description: 'Foster appreciation for life sciences, environmental conservation, and practical school farming initiatives.',
      responsibilities: [
        'Conduct biology practical sessions using micro-view equipment and preserved specimens',
        'Oversee the school agricultural practical farm project plot',
        'Prepare students for WAEC and NECO practical biology exams'
      ]
    }
  ];

  const filteredJobs = openVacancies.filter(
    (job) => selectedJob === 'all' || job.id === selectedJob
  );

  const handleSubmitApplication = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName.trim() || !formData.email.trim() || !formData.phone.trim()) {
      alert('Please complete all required contact fields.');
      return;
    }

    const appCode = `DA-TCH-${Math.floor(100000 + Math.random() * 900000)}`;
    setSubmittedAppCode(appCode);
    window.scrollTo({ top: 300, behavior: 'smooth' });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16 animate-fade-in">
      
      {/* Hero Header */}
      <div className="relative bg-slate-900 rounded-3xl p-8 sm:p-12 lg:p-16 text-white overflow-hidden shadow-2xl border border-slate-800">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-amber-500/10 blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none"></div>

        <div className="relative z-10 max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider">
            <Briefcase className="w-4 h-4 text-amber-400" />
            Careers at Divine Academy
          </div>

          <h1 className="font-serif font-black text-3xl sm:text-5xl lg:text-6xl text-white leading-tight">
            Shape the Future. <br />
            <span className="text-amber-400">Join Our Elite Teaching Faculty.</span>
          </h1>

          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            At {systemSettings.schoolName || 'Divine Academy Secondary School'}, we believe outstanding educators are the heartbeat of academic excellence. We offer a supportive, tech-enabled environment, competitive compensation, and continuous professional growth.
          </p>

          <div className="flex flex-wrap items-center gap-6 pt-2 text-xs font-bold text-slate-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-400" /> TRCN Accredited School
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-400" /> Modern CBT & Smart Classrooms
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-400" /> Professional Advancement
            </div>
          </div>
        </div>
      </div>

      {/* Success Modal / Banner when application submitted */}
      {submittedAppCode && (
        <div className="bg-emerald-950 border-2 border-emerald-500 rounded-3xl p-8 text-white space-y-4 shadow-2xl animate-fade-in max-w-3xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center text-2xl font-bold flex-shrink-0">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-xl text-emerald-300">
                Application Received Successfully!
              </h3>
              <p className="text-xs text-emerald-200">
                Your teaching job application has been logged in our HR recruitment registry.
              </p>
            </div>
          </div>

          <div className="bg-slate-900/80 p-4 rounded-2xl border border-emerald-800/80 space-y-2 text-xs font-mono">
            <div className="flex justify-between items-center text-slate-300">
              <span>Application Ref Code:</span>
              <strong className="text-amber-400 text-sm font-bold">{submittedAppCode}</strong>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span>Position Applied For:</span>
              <span className="text-white font-bold">{formData.position}</span>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span>Applicant Name:</span>
              <span className="text-white">{formData.fullName}</span>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Our Academic Recruitment Board will review your credentials and contact you via email (<strong>{formData.email}</strong>) or phone (<strong>{formData.phone}</strong>) for the interview phase.
          </p>

          <div className="pt-2 flex flex-wrap gap-3">
            <button
              onClick={() => setSubmittedAppCode(null)}
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-6 py-2.5 rounded-xl text-xs transition-all"
            >
              Submit Another Application
            </button>

            <a
              href={`https://wa.me/2348131817596?text=${encodeURIComponent(`Hello Divine Academy HR, I submitted my teaching application for ${formData.position} with Ref Code: ${submittedAppCode}.`)}`}
              target="_blank"
              rel="noreferrer"
              className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs flex items-center gap-2 border border-slate-700"
            >
              <Send className="w-3.5 h-3.5 text-emerald-400" /> Notify HR on WhatsApp (08131817596)
            </a>
          </div>
        </div>
      )}

      {/* Why Teach With Us - 4 Benefit Cards */}
      <div className="space-y-6">
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <span className="text-xs font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
            Faculty Perks & Culture
          </span>
          <h2 className="font-serif font-bold text-2xl sm:text-3xl text-slate-900 dark:text-white">
            Why Educators Excel at Divine Academy
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Award className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">Competitive Remuneration</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Timely salary disbursements, performance incentives, and annual review bonuses for dedicated teaching staff.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Laptop className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">Modern Tech Classrooms</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Equipped with digital projectors, CBT evaluation platforms, and modern laboratory apparatus to ease teaching delivery.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <GraduationCap className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">Professional Growth</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Regular pedagogy workshops, ICT mastery training, and assistance with TRCN professional licensing requirements.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">Supportive Community</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              A disciplined student body, cooperative parent association, and collaborative departmental team spirit.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Grid: Vacancies List & Application Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        
        {/* Left Column: Vacancies Explorer */}
        <div className="lg:col-span-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <h3 className="font-serif font-bold text-xl text-slate-900 dark:text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-amber-500" /> Open Teaching Vacancies
              </h3>
              <p className="text-xs text-slate-500">
                Select a position to view requirements or apply below.
              </p>
            </div>

            <span className="bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold text-xs px-3 py-1 rounded-full border border-amber-300 dark:border-amber-800">
              {openVacancies.length} Roles Active
            </span>
          </div>

          <div className="space-y-4">
            {openVacancies.map((vacancy) => (
              <div
                key={vacancy.id}
                className={`bg-white dark:bg-slate-900 rounded-2xl border p-6 space-y-4 transition-all ${
                  formData.position === vacancy.title
                    ? 'border-amber-500 ring-2 ring-amber-500/20 shadow-lg'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md text-amber-600 dark:text-amber-400">
                      {vacancy.department}
                    </span>
                    <h4 className="font-serif font-bold text-lg text-slate-900 dark:text-white mt-1">
                      {vacancy.title}
                    </h4>
                  </div>

                  <span className="text-xs font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 px-2.5 py-1 rounded-lg">
                    {vacancy.type}
                  </span>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {vacancy.description}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="text-slate-700 dark:text-slate-300">
                    <strong className="text-slate-900 dark:text-white">Required:</strong> {vacancy.qualification}
                  </div>
                  <div className="text-slate-700 dark:text-slate-300">
                    <strong className="text-slate-900 dark:text-white">Experience:</strong> {vacancy.experience}
                  </div>
                </div>

                <div className="space-y-1.5 pt-1">
                  <p className="text-[11px] font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Key Responsibilities:
                  </p>
                  <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
                    {vacancy.responsibilities.map((resp, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                        <span>{resp}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setFormData((prev) => ({ ...prev, position: vacancy.title }));
                      const formElem = document.getElementById('teaching-app-form');
                      formElem?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      formData.position === vacancy.title
                        ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                        : 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700'
                    }`}
                  >
                    <span>{formData.position === vacancy.title ? 'Selected for Form' : 'Apply for this Role'}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Online Teaching Application Form */}
        <div id="teaching-app-form" className="lg:col-span-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-6 shadow-xl sticky top-28">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Official Application Portal
            </span>
            <h3 className="font-serif font-bold text-2xl text-slate-900 dark:text-white flex items-center gap-2 mt-0.5">
              <FileText className="w-6 h-6 text-amber-500" /> Teaching Job Application Form
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Submit your curriculum vitae and academic qualifications for recruitment review.
            </p>
          </div>

          <form onSubmit={handleSubmitApplication} className="space-y-4 text-xs">
            {/* Position Select */}
            <div className="space-y-1">
              <label className="block font-bold text-slate-800 dark:text-slate-200">
                Target Teaching Position *
              </label>
              <select
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white outline-none focus:border-amber-500"
              >
                {openVacancies.map((v) => (
                  <option key={v.id} value={v.title}>
                    {v.title} ({v.department})
                  </option>
                ))}
                <option value="General Teaching Application (Other Subjects)">
                  General Teaching Application (Other Subjects)
                </option>
              </select>
            </div>

            {/* Personal Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1 sm:col-span-2">
                <label className="block font-bold text-slate-800 dark:text-slate-200">
                  Full Name (Title, First Name, Last Name) *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="e.g. Mr. Emmanuel Olatunji"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-semibold text-slate-900 dark:text-white outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-800 dark:text-slate-200">
                  Email Address *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="e.g. emmanuel@gmail.com"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-semibold text-slate-900 dark:text-white outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-800 dark:text-slate-200">
                  Phone / WhatsApp Number *
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="e.g. 08131817596"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* Academic Credentials */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1">
                <label className="block font-bold text-slate-800 dark:text-slate-200">
                  Highest Qualification *
                </label>
                <select
                  value={formData.qualification}
                  onChange={(e) => setFormData({ ...formData, qualification: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-semibold text-slate-900 dark:text-white outline-none focus:border-amber-500"
                >
                  <option value="B.Ed (Bachelor of Education)">B.Ed (Bachelor of Education)</option>
                  <option value="B.Sc / B.A + PGDE">B.Sc / B.A + PGDE</option>
                  <option value="B.Sc / B.A / B.Tech (Pure Discipline)">B.Sc / B.A / B.Tech (Pure Discipline)</option>
                  <option value="M.Ed / M.Sc / M.A">M.Ed / M.Sc / M.A</option>
                  <option value="NCE (National Certificate in Education)">NCE (National Certificate in Education)</option>
                  <option value="Ph.D">Ph.D</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-800 dark:text-slate-200">
                  Course of Study / Major
                </label>
                <input
                  type="text"
                  value={formData.courseOfStudy}
                  onChange={(e) => setFormData({ ...formData, courseOfStudy: e.target.value })}
                  placeholder="e.g. Mathematics & Computer Education"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-semibold text-slate-900 dark:text-white outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-800 dark:text-slate-200">
                  Years of Teaching Experience
                </label>
                <select
                  value={formData.yearsExperience}
                  onChange={(e) => setFormData({ ...formData, yearsExperience: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-semibold text-slate-900 dark:text-white outline-none focus:border-amber-500"
                >
                  <option value="1-3 years">1 - 3 Years</option>
                  <option value="3-5 years">3 - 5 Years</option>
                  <option value="5+ years">5+ Years Senior Experience</option>
                  <option value="Fresh Graduate / Intern">Fresh Graduate / Intern Teacher</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-800 dark:text-slate-200">
                  TRCN Reg. Number (Optional)
                </label>
                <input
                  type="text"
                  value={formData.trcnNumber}
                  onChange={(e) => setFormData({ ...formData, trcnNumber: e.target.value })}
                  placeholder="e.g. TRCN/ABJ/2023/..."
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono text-slate-900 dark:text-white outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Previous School & Resume Link */}
            <div className="space-y-1 pt-1">
              <label className="block font-bold text-slate-800 dark:text-slate-200">
                CV / Resume Online Link or Google Drive URL
              </label>
              <input
                type="url"
                value={formData.resumeLink}
                onChange={(e) => setFormData({ ...formData, resumeLink: e.target.value })}
                placeholder="https://drive.google.com/file/d/your-cv"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-semibold text-slate-900 dark:text-white outline-none focus:border-amber-500"
              />
              <p className="text-[11px] text-slate-500">You can also send your CV document directly via WhatsApp to 08131817596 after submitting.</p>
            </div>

            {/* Brief Statement / Cover Letter */}
            <div className="space-y-1">
              <label className="block font-bold text-slate-800 dark:text-slate-200">
                Cover Letter & Teaching Philosophy
              </label>
              <textarea
                rows={3}
                value={formData.coverLetter}
                onChange={(e) => setFormData({ ...formData, coverLetter: e.target.value })}
                placeholder="Briefly state why you are passionate about teaching at Divine Academy..."
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:border-amber-500 resize-none"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-black py-4 rounded-xl text-sm transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 transform active:scale-98 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              Submit Teaching Job Application
            </button>
          </form>
        </div>

      </div>

    </div>
  );
};
