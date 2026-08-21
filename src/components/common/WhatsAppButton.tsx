import React, { useState } from 'react';
import { useSchool } from '../../context/SchoolContext';
import { X, Send, Sparkles } from 'lucide-react';

export const WhatsAppButton: React.FC = () => {
  const { systemSettings } = useSchool();
  const [isOpen, setIsOpen] = useState(false);
  const [customMessage, setCustomMessage] = useState('');

  // Target WhatsApp phone number requested by user
  const whatsappNumber = '08131817596';
  // Standard international clean phone for WhatsApp wa.me API format (2348131817596)
  const cleanPhone = '2348131817596';

  const defaultGreeting = `Hello ${systemSettings.schoolName || 'DIVINE ACADEMY SECONDARY SCHOOL'}, I would like to make an inquiry.`;

  const handleOpenWhatsApp = (messageText?: string) => {
    const textToUse = messageText || customMessage.trim() || defaultGreeting;
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(textToUse)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const quickTopics = [
    { label: '🎒 Admissions Inquiry', text: `Hello, I would like to inquire about student admissions at ${systemSettings.schoolName || 'Divine Academy'}.` },
    { label: '💵 School Fees & Registration', text: `Hello, please provide information regarding school fees and registration details.` },
    { label: '🏫 Campus Tour & Visit', text: `Hello, I would like to schedule a visit to the school campus.` },
  ];

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-auto">
      {/* Quick Interactive Chat Popup Box */}
      {isOpen && (
        <div className="mb-4 w-80 sm:w-88 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200">
          {/* Header */}
          <div className="bg-emerald-600 dark:bg-emerald-700 p-4 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center text-white border border-white/30">
                  <WhatsAppSvg className="w-6 h-6 fill-current text-white" />
                </div>
                <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-emerald-700"></span>
              </div>
              <div>
                <h4 className="font-bold text-sm leading-tight">Divine Academy Support</h4>
                <p className="text-[11px] text-emerald-100 flex items-center gap-1 font-mono">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse"></span>
                  {whatsappNumber}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-full hover:bg-white/20 text-white transition-colors cursor-pointer"
              title="Close chat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body content */}
          <div className="p-4 space-y-4 bg-slate-50/50 dark:bg-slate-950/50 text-xs">
            {/* Welcome message bubble */}
            <div className="bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 space-y-1 shadow-xs">
              <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-500" /> Welcome to Divine Academy!
              </p>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                Chat directly with our desk on WhatsApp at <strong className="font-mono text-emerald-600 dark:text-emerald-400">{whatsappNumber}</strong> for quick assistance!
              </p>
            </div>

            {/* Quick Prompts */}
            <div className="space-y-1.5">
              <p className="font-bold text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
                Frequently Asked Topics:
              </p>
              {quickTopics.map((topic, i) => (
                <button
                  key={i}
                  onClick={() => handleOpenWhatsApp(topic.text)}
                  className="w-full text-left p-2.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:border-emerald-300 dark:hover:border-emerald-700 border border-slate-200 dark:border-slate-700 transition-all font-medium text-slate-700 dark:text-slate-200 flex items-center justify-between group cursor-pointer"
                >
                  <span>{topic.label}</span>
                  <Send className="w-3 h-3 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                </button>
              ))}
            </div>

            {/* Custom message input */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <textarea
                rows={2}
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="Type your message here..."
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:border-emerald-500 text-xs resize-none"
              />

              <button
                onClick={() => handleOpenWhatsApp()}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg active:scale-98 cursor-pointer"
              >
                <WhatsAppSvg className="w-4 h-4 fill-current" />
                <span>Chat on WhatsApp ({whatsappNumber})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Hover Action Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="group relative flex items-center gap-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-4 py-3.5 rounded-full shadow-2xl transition-all hover:scale-105 active:scale-95 border-2 border-white dark:border-slate-900 focus:outline-none cursor-pointer"
        aria-label="Chat with us on WhatsApp"
      >
        {/* Animated pulse ring */}
        <span className="absolute -inset-1 rounded-full bg-emerald-500/40 animate-ping opacity-75"></span>

        <WhatsAppSvg className="w-6 h-6 fill-current relative z-10" />

        <span className="hidden sm:inline text-xs font-extrabold tracking-wide relative z-10 pr-1">
          WhatsApp ({whatsappNumber})
        </span>

        {/* Online Indicator Badge */}
        <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-emerald-300 border-2 border-white dark:border-slate-900 rounded-full"></span>
      </button>
    </div>
  );
};

// Official SVG vector icon for WhatsApp
const WhatsAppSvg: React.FC<{ className?: string }> = ({ className = "w-5 h-5 fill-current" }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
  </svg>
);
