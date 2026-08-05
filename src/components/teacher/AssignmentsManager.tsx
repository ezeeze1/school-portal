import React, { useState } from 'react';
import { useSchool } from '../../context/SchoolContext';
import { Assignment, StudyNote } from '../../types';
import { BookOpen, Plus, FileText, Upload, Trash2, CheckCircle2 } from 'lucide-react';

export const AssignmentsManager: React.FC = () => {
  const { assignments, studyNotes, addAssignment, addStudyNote, classes, subjects } = useSchool();
  const [activeTab, setActiveTab] = useState<'assignments' | 'notes'>('assignments');

  // Assignment Form State
  const [asgTitle, setAsgTitle] = useState('');
  const [asgClassId, setAsgClassId] = useState('c-ss2');
  const [asgSubjId, setAsgSubjId] = useState('sub-mth');
  const [asgDesc, setAsgDesc] = useState('');
  const [asgDueDate, setAsgDueDate] = useState('2026-08-15');

  // Note Form State
  const [noteTitle, setNoteTitle] = useState('');
  const [noteSubjId, setNoteSubjId] = useState('sub-mth');
  const [noteDesc, setNoteDesc] = useState('');

  const handleCreateAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    const subj = subjects.find((s) => s.id === asgSubjId);
    const cls = classes.find((c) => c.id === asgClassId);

    const newAsg: Omit<Assignment, 'id'> = {
      title: asgTitle,
      subjectId: asgSubjId,
      subjectName: subj?.name || 'Mathematics',
      classId: asgClassId,
      className: cls?.name || 'SS 2',
      teacherId: 'tch-102',
      teacherName: 'Dr. (Mrs.) Victoria Adebayo',
      description: asgDesc,
      dueDate: asgDueDate,
      createdDate: new Date().toISOString().split('T')[0],
      totalMarks: 20,
    };

    addAssignment(newAsg);
    setAsgTitle('');
    setAsgDesc('');
  };

  const handleCreateNote = (e: React.FormEvent) => {
    e.preventDefault();
    const subj = subjects.find((s) => s.id === noteSubjId);

    const newNote: Omit<StudyNote, 'id'> = {
      title: noteTitle,
      subjectId: noteSubjId,
      subjectName: subj?.name || 'Mathematics',
      classId: 'c-ss2',
      className: 'SS 2',
      teacherId: 'tch-102',
      description: noteDesc,
      fileUrl: '#',
      fileSize: '2.4 MB PDF',
      uploadDate: new Date().toISOString().split('T')[0],
    };

    addStudyNote(newNote);
    setNoteTitle('');
    setNoteDesc('');
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      
      {/* Header Controls */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-md flex justify-between items-center">
        <div>
          <h2 className="font-serif font-bold text-2xl text-slate-900 dark:text-white">
            Assignments & E-Notes Repository
          </h2>
          <p className="text-xs text-slate-500">Upload homework tasks and share downloadable reading materials with students.</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('assignments')}
            className={`px-4 py-2 rounded-xl text-xs font-bold ${
              activeTab === 'assignments' ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            Manage Assignments ({assignments.length})
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`px-4 py-2 rounded-xl text-xs font-bold ${
              activeTab === 'notes' ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            Manage Study Notes ({studyNotes.length})
          </button>
        </div>
      </div>

      {activeTab === 'assignments' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Create Assignment Form */}
          <form onSubmit={handleCreateAssignment} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-md">
            <h3 className="font-serif font-bold text-lg text-slate-900 dark:text-white">Upload New Homework</h3>
            
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Assignment Title</label>
                <input
                  type="text"
                  required
                  value={asgTitle}
                  onChange={(e) => setAsgTitle(e.target.value)}
                  placeholder="e.g. Quadratic Equations Practice"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1">Target Class</label>
                  <select
                    value={asgClassId}
                    onChange={(e) => setAsgClassId(e.target.value)}
                    className="w-full px-2.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                  >
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Subject</label>
                  <select
                    value={asgSubjId}
                    onChange={(e) => setAsgSubjId(e.target.value)}
                    className="w-full px-2.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                  >
                    {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Due Date</label>
                <input
                  type="date"
                  required
                  value={asgDueDate}
                  onChange={(e) => setAsgDueDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Instructions / Description</label>
                <textarea
                  required
                  rows={3}
                  value={asgDesc}
                  onChange={(e) => setAsgDesc(e.target.value)}
                  placeholder="Detailed instructions..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> Post Homework Assignment
              </button>
            </div>
          </form>

          {/* Assignments List */}
          <div className="lg:col-span-2 space-y-4">
            {assignments.map((asg) => (
              <div key={asg.id} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-2 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-bold uppercase bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded">
                      {asg.subjectName} • {asg.className}
                    </span>
                    <h4 className="font-bold text-base text-slate-900 dark:text-white mt-1">{asg.title}</h4>
                  </div>
                  <span className="text-xs text-red-500 font-bold">Due: {asg.dueDate}</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">{asg.description}</p>
              </div>
            ))}
          </div>

        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Note Upload Form */}
          <form onSubmit={handleCreateNote} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-md">
            <h3 className="font-serif font-bold text-lg text-slate-900 dark:text-white">Upload New Lecture Note</h3>
            
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Note Title</label>
                <input
                  type="text"
                  required
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder="e.g. Calculus & Vectors Chapter 4"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Subject</label>
                <select
                  value={noteSubjId}
                  onChange={(e) => setNoteSubjId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                >
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Summary Note Description</label>
                <textarea
                  required
                  rows={3}
                  value={noteDesc}
                  onChange={(e) => setNoteDesc(e.target.value)}
                  placeholder="Topic summary..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-amber-500 text-white dark:text-slate-950 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" /> Publish PDF Study Note
              </button>
            </div>
          </form>

          {/* Notes List */}
          <div className="lg:col-span-2 space-y-4">
            {studyNotes.map((note) => (
              <div key={note.id} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-2 shadow-sm">
                <span className="text-[10px] font-bold uppercase bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 px-2 py-0.5 rounded">
                  {note.subjectName}
                </span>
                <h4 className="font-bold text-base text-slate-900 dark:text-white">{note.title}</h4>
                <p className="text-xs text-slate-500">{note.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
