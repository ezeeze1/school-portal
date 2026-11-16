import React from 'react';
import { useSchool } from '../../context/SchoolContext';
import { Mail, Phone, MapPin, ShieldCheck } from 'lucide-react';

export const Footer: React.FC = () => {
  const { setCurrentView, systemSettings } = useSchool();

  return (
    <footer className="bg-slate-950 text-slate-400 pt-16 pb-8 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        {/* Main Footer Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          
          {/* Column 1: School Bio */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 font-serif font-black text-xl flex items-center justify-center">
                {systemSettings.schoolLogoText || 'DA'}
              </div>
              <div>
                <span className="font-serif font-bold text-lg text-white block uppercase">
                  {systemSettings.schoolName || 'DIVINE ACADEMY SECONDARY SCHOOL'}
                </span>
                <span className="text-xs text-amber-400 font-semibold italic">
                  "{systemSettings.schoolMotto || 'Excellent of Divine Wisdom'}"
                </span>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-slate-400 max-w-sm">
              An elite educational institution committed to nurturing academic leaders, fostering divine wisdom, sound character, and inspiring technological innovation.
            </p>
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 bg-amber-950/40 border border-amber-900/50 p-2.5 rounded-xl w-fit">
              <ShieldCheck className="w-4 h-4" />
              Fully Accredited by Ministry of Education
            </div>
          </div>

          {/* Column 2: Quick Links */}
          <div>
            <h4 className="font-serif font-bold text-white text-sm tracking-wider uppercase mb-4">
              Public Portal
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <button onClick={() => setCurrentView('home')} className="hover:text-amber-400 transition-colors">Home Page</button>
              </li>
              <li>
                <button onClick={() => setCurrentView('about')} className="hover:text-amber-400 transition-colors">About Divine Academy</button>
              </li>
              <li>
                <button onClick={() => setCurrentView('admissions')} className="hover:text-amber-400 transition-colors">Admissions & Fees</button>
              </li>
              <li>
                <button onClick={() => setCurrentView('news')} className="hover:text-amber-400 transition-colors">News & Events</button>
              </li>
              <li>
                <button onClick={() => setCurrentView('gallery')} className="hover:text-amber-400 transition-colors">Campus Gallery</button>
              </li>
              <li>
                <button onClick={() => setCurrentView('employment')} className="hover:text-amber-400 transition-colors">Teaching Employment & Careers</button>
              </li>
            </ul>
          </div>

          {/* Column 3: Portals */}
          <div>
            <h4 className="font-serif font-bold text-white text-sm tracking-wider uppercase mb-4">
              Secure Portals
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <button onClick={() => setCurrentView('student-portal')} className="hover:text-amber-400 transition-colors">Student CBT Portal</button>
              </li>
              <li>
                <button onClick={() => setCurrentView('teacher-portal')} className="hover:text-amber-400 transition-colors">Teacher Assessment</button>
              </li>
              <li>
                <button onClick={() => setCurrentView('parent-portal')} className="hover:text-amber-400 transition-colors">Parent Monitoring</button>
              </li>
              <li>
                <button onClick={() => setCurrentView('admin-portal')} className="hover:text-amber-400 transition-colors">Administrator Panel</button>
              </li>
              <li>
                <button onClick={() => setCurrentView('apply')} className="hover:text-amber-400 transition-colors">Online Application</button>
              </li>
            </ul>
          </div>

          {/* Column 4: Contact Info */}
          <div>
            <h4 className="font-serif font-bold text-white text-sm tracking-wider uppercase mb-4">
              Contact & Location
            </h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <span>{systemSettings.schoolAddress || 'Divine Academy Lane, Phase II, Abuja, Nigeria'}</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span>{systemSettings.schoolPhone || '+234 803 111 2233'}</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span>{systemSettings.schoolEmail || 'admissions@divineacademy.edu'}</span>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom Bar & Reset Data Button */}
        <div className="pt-8 border-t border-slate-900 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} {systemSettings.schoolName || 'DIVINE ACADEMY SECONDARY SCHOOL'}. All rights reserved.</p>
          
          <div className="flex items-center gap-4">
            <span className="text-slate-500">Powered by Academy360 Engine</span>
          </div>
        </div>

      </div>
    </footer>
  );
};
