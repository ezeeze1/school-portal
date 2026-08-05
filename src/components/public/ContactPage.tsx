import React, { useState } from 'react';
import { Mail, Phone, MapPin, Send, Clock, CheckCircle2 } from 'lucide-react';

export const ContactPage: React.FC = () => {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', subject: '', message: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      
      {/* Page Title */}
      <div className="text-center space-y-3 max-w-3xl mx-auto">
        <span className="text-xs font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
          Get in Touch
        </span>
        <h1 className="font-serif font-black text-3xl sm:text-5xl text-slate-900 dark:text-white uppercase">
          Contact DIVINE ACADEMY SECONDARY SCHOOL
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm">
          Have questions regarding admissions, fees, or campus tours? Send us a message or call our help desk.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Contact Information Panel */}
        <div className="bg-slate-900 text-white p-8 rounded-3xl border border-slate-800 space-y-6 shadow-xl">
          <h3 className="font-serif font-bold text-2xl text-amber-400">Main Campus Desk</h3>
          
          <ul className="space-y-4 text-sm">
            <li className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-white">Address</p>
                <p className="text-xs text-slate-300">Plot 45 Admiralty Way, Victoria Island, Lagos, Nigeria</p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <Phone className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-white">Phone Helpdesk</p>
                <p className="text-xs text-slate-300">+234 803 111 2233 / +234 802 333 4455</p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-white">Email Address</p>
                <p className="text-xs text-slate-300">admissions@divineacademy.edu | info@divineacademy.edu</p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-white">Office Hours</p>
                <p className="text-xs text-slate-300">Monday - Friday: 7:30 AM - 4:30 PM (WAT)</p>
              </div>
            </li>
          </ul>

          <div className="pt-4 border-t border-slate-800 text-xs text-slate-400">
            <p className="font-bold text-white mb-1">Guided Campus Tours:</p>
            <p>Tours take place every Tuesday and Thursday at 10:00 AM by prior appointment.</p>
          </div>
        </div>

        {/* Contact Form */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md">
          {submitted ? (
            <div className="text-center py-12 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="font-serif font-bold text-2xl text-slate-900 dark:text-white">Inquiry Received!</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                Thank you for contacting DIVINE ACADEMY SECONDARY SCHOOL. Our admissions desk will review your message and reply via email within 24 hours.
              </p>
              <button
                onClick={() => setSubmitted(false)}
                className="bg-slate-900 text-white font-bold px-6 py-2.5 rounded-xl text-xs"
              >
                Send Another Message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <h3 className="font-serif font-bold text-2xl text-slate-900 dark:text-white mb-4">
                Send an Inquiry Message
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Your Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Dr. Samuel Okafor"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="samuel.okafor@gmail.com"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+234 803 000 0000"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Inquiry Subject
                  </label>
                  <select
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                  >
                    <option value="">Select subject topic</option>
                    <option value="Admissions & CBT">Admissions & CBT Entrance</option>
                    <option value="Fee Schedule">Fee Schedule & Payment</option>
                    <option value="Campus Tour">Campus Tour Request</option>
                    <option value="General Inquiry">General Inquiry</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Message Details
                </label>
                <textarea
                  required
                  rows={4}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Write your message here..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <button
                type="submit"
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-8 py-3 rounded-xl text-xs transition-colors flex items-center gap-2"
              >
                Submit Inquiry Message <Send className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>

      </div>

    </div>
  );
};
