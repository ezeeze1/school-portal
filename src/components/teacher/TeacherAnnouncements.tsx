import React, { useState } from 'react';
import { useSchool } from '../../context/SchoolContext';
import { Announcement } from '../../types';
import { Send, Bell, CheckCircle2 } from 'lucide-react';

export const TeacherAnnouncements: React.FC = () => {
  const { announcements, sendAnnouncement, currentUser } = useSchool();
  const [title, setTitle] = useState('');
  const [targetAudience, setTargetAudience] = useState<'All' | 'Students' | 'Parents' | 'Teachers'>('Students');
  const [message, setMessage] = useState('');
  const [sentSuccess, setSentSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedMessage = message.trim();
    if (!trimmedTitle || !trimmedMessage) {
      setErrorMsg('Please enter both an announcement title and message.');
      return;
    }

    setErrorMsg('');
    const newAnn: Omit<Announcement, 'id' | 'date'> = {
      title: trimmedTitle,
      sender: currentUser?.name || 'Form Teacher',
      targetAudience,
      message: trimmedMessage,
    };
    sendAnnouncement(newAnn);
    setTitle('');
    setMessage('');
    setSentSuccess(true);
    setTimeout(() => setSentSuccess(false), 3000);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      
      {/* Broadcast Form */}
      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 space-y-6 shadow-xl">
        <h2 className="font-serif font-bold text-2xl text-slate-900 dark:text-white flex items-center gap-2">
          <Bell className="w-6 h-6 text-amber-500" /> Send Broadcast Announcement
        </h2>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs font-bold text-red-700 dark:text-red-300">
            {errorMsg}
          </div>
        )}

        {sentSuccess && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Broadcast announcement sent!
          </div>
        )}

        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold mb-1">Announcement Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Mandatory Physics Lab Gear for Tomorrow"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1">Target Audience</label>
            <select
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value as any)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
            >
              <option value="Students">Class Students Only</option>
              <option value="Parents">Parents / Guardians</option>
              <option value="All">Entire School Community</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold mb-1">Broadcast Content</label>
            <textarea
              required
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write broadcast message details..."
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
            />
          </div>

          <button
            type="submit"
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-8 py-3 rounded-xl text-xs flex items-center gap-2"
          >
            <Send className="w-4 h-4" /> Send Instant Broadcast Notification
          </button>
        </div>
      </form>

      {/* Broadcast History */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-md">
        <h3 className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
          Sent Announcements History ({announcements.length})
        </h3>

        <div className="space-y-3">
          {announcements.map((ann) => (
            <div key={ann.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-1 text-xs">
              <div className="flex justify-between items-center font-bold">
                <span className="text-slate-900 dark:text-white">{ann.title}</span>
                <span className="text-amber-600">Audience: {ann.targetAudience}</span>
              </div>
              <p className="text-slate-600 dark:text-slate-400">{ann.message}</p>
              <p className="text-[10px] text-slate-400">Date: {ann.date} • By {ann.sender}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
