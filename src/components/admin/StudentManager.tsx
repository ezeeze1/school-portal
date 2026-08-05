import React, { useState } from 'react';
import { useSchool } from '../../context/SchoolContext';
import { Student } from '../../types';
import { Plus, Trash2, Edit, Search, ShieldCheck, Key, Lock, CheckCircle2, RefreshCw, Copy, Check, Printer, Sparkles } from 'lucide-react';

export const StudentManager: React.FC = () => {
  const { students, classes, addStudent, updateStudent, deleteStudent, generateResultPasscodeForStudent, bulkGenerateResultPasscodes } = useSchool();
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [showPasscodeSlipsModal, setShowPasscodeSlipsModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Helper generator
  const createAlphanumericCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'RES-';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  // Enroll New Student Form state
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    admissionNo: `STD/2026/${Math.floor(1000 + Math.random() * 9000)}`,
    classId: 'c-ss2',
    className: 'SS 2',
    gender: 'Male' as 'Male' | 'Female',
    dob: '2010-04-12',
    parentName: '',
    parentPhone: '',
    password: 'student123',
    resultPasscode: createAlphanumericCode(),
    address: 'Lagos, Nigeria',
  });

  // Edit Student Form state
  const [editFormData, setEditFormData] = useState<Partial<Student>>({});

  const filteredStudents = students.filter(
    (s) =>
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      s.admissionNo.toLowerCase().includes(search.toLowerCase()) ||
      s.className.toLowerCase().includes(search.toLowerCase()) ||
      (s.resultPasscode && s.resultPasscode.toLowerCase().includes(search.toLowerCase()))
  );

  const handleBulkPasscodes = () => {
    bulkGenerateResultPasscodes();
    setNotification('Result access passcodes updated for all enrolled students!');
    setTimeout(() => setNotification(null), 3500);
  };

  const handleRegenerateOne = (stdId: string) => {
    const newCode = generateResultPasscodeForStudent(stdId);
    setNotification(`New alphanumeric passcode generated: ${newCode}`);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const selCls = classes.find((c) => c.id === formData.classId);

    const newStd: Omit<Student, 'id'> = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      admissionNo: formData.admissionNo || `STD/2026/${Math.floor(1000 + Math.random() * 9000)}`,
      classId: formData.classId,
      className: selCls?.name || formData.className,
      gender: formData.gender,
      dob: formData.dob,
      parentName: formData.parentName,
      parentPhone: formData.parentPhone,
      password: formData.password,
      resultPasscode: formData.resultPasscode || createAlphanumericCode(),
      address: formData.address,
      status: 'Active',
      avatar: `https://images.unsplash.com/photo-${1534528741775 + Math.floor(Math.random() * 1000)}?auto=format&fit=crop&w=300&q=80`,
    };

    addStudent(newStd);
    setShowAddModal(false);
    // Reset form for next enrollment
    setFormData({
      firstName: '',
      lastName: '',
      admissionNo: `STD/2026/${Math.floor(1000 + Math.random() * 9000)}`,
      classId: 'c-ss2',
      className: 'SS 2',
      gender: 'Male',
      dob: '2010-04-12',
      parentName: '',
      parentPhone: '',
      password: 'student123',
      resultPasscode: createAlphanumericCode(),
      address: 'Lagos, Nigeria',
    });
  };

  const handleStartEdit = (std: Student) => {
    setEditingStudent(std);
    setEditFormData({ ...std });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    updateStudent(editingStudent.id, editFormData);
    setEditingStudent(null);
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      
      {/* Toast Notification */}
      {notification && (
        <div className="bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-200 p-4 rounded-2xl border border-emerald-300 dark:border-emerald-800 flex items-center justify-between text-xs font-bold animate-fade-in shadow-md">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            {notification}
          </span>
        </div>
      )}

      {/* Header & Controls */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="font-serif font-bold text-2xl text-slate-900 dark:text-white">
            Student Information & Result Passcodes
          </h2>
          <p className="text-xs text-slate-500">Manage student profiles, portal passwords, and alphanumeric terminal result access passcodes.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <div className="relative flex-1 md:w-56">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search student or passcode..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          <button
            onClick={handleBulkPasscodes}
            className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-colors border border-slate-200 dark:border-slate-700"
            title="Generate/Refresh result passcodes for all students"
          >
            <RefreshCw className="w-3.5 h-3.5 text-amber-500" /> Bulk Passcodes
          </button>

          <button
            onClick={() => setShowPasscodeSlipsModal(true)}
            className="bg-slate-900 dark:bg-slate-800 text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 hover:bg-slate-800 border border-slate-700 shadow-sm"
          >
            <Printer className="w-3.5 h-3.5 text-amber-400" /> Passcode Slips
          </button>

          <button
            onClick={() => {
              setFormData((prev) => ({ ...prev, resultPasscode: createAlphanumericCode() }));
              setShowAddModal(true);
            }}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 whitespace-nowrap shadow-sm"
          >
            <Plus className="w-4 h-4" /> Enroll Student
          </button>
        </div>
      </div>

      {/* Roster Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900 text-white font-semibold">
                <th className="p-3.5">Admission No</th>
                <th className="p-3.5">Student Name</th>
                <th className="p-3.5">Class</th>
                <th className="p-3.5">Result Passcode (Admin)</th>
                <th className="p-3.5">Guardian & Contact</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    No students found matching your search query.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((std) => {
                  const passcode = std.resultPasscode || 'RES-8K9M2P';
                  return (
                    <tr key={std.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="p-3.5 font-mono font-bold text-slate-900 dark:text-white">{std.admissionNo}</td>
                      <td className="p-3.5">
                        <div className="flex items-center gap-2.5">
                          <img src={std.avatar} alt={std.firstName} className="w-9 h-9 rounded-full object-cover border border-slate-200" />
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white">{std.firstName} {std.lastName}</p>
                            <p className="text-[10px] text-slate-400">{std.gender} • DOB: {std.dob}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3.5 font-semibold text-slate-800 dark:text-slate-200">{std.className}</td>
                      <td className="p-3.5">
                        <div className="inline-flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-1.5 rounded-xl border border-amber-200 dark:border-amber-800/80">
                          <Key className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                          <span className="font-mono font-bold text-amber-900 dark:text-amber-200 text-xs tracking-wider">
                            {passcode}
                          </span>
                          <button
                            onClick={() => handleCopy(passcode, std.id)}
                            className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white ml-1"
                            title="Copy Passcode"
                          >
                            {copiedId === std.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                          </button>
                          <button
                            onClick={() => handleRegenerateOne(std.id)}
                            className="p-1 text-amber-600 hover:text-amber-800 dark:hover:text-amber-300"
                            title="Regenerate Alphanumeric Code"
                          >
                            <RefreshCw className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                      <td className="p-3.5 text-slate-600 dark:text-slate-400">
                        <p className="font-semibold text-slate-900 dark:text-white">{std.parentName}</p>
                        <p className="text-[11px] text-slate-500">{std.parentPhone}</p>
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          std.status === 'Active' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                        }`}>
                          {std.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleStartEdit(std)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 rounded-lg transition-colors flex items-center gap-1 font-semibold text-[11px]"
                            title="Edit Student Profile"
                          >
                            <Edit className="w-4 h-4" /> Edit
                          </button>
                          <button
                            onClick={() => deleteStudent(std.id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition-colors"
                            title="Delete Record"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Enroll New Student Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <form onSubmit={handleAddSubmit} className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-lg w-full space-y-4 shadow-2xl">
            <h3 className="font-serif font-bold text-xl text-slate-900 dark:text-white">Enroll New Student</h3>
            <p className="text-xs text-slate-500">Fill in details and assign portal password and result access passcode.</p>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">First Name *</label>
                <input
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                  placeholder="e.g. David"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Last Name *</label>
                <input
                  type="text"
                  required
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                  placeholder="e.g. Chukwu"
                />
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label className="block font-semibold mb-1">Class *</label>
                <select
                  value={formData.classId}
                  onChange={(e) => {
                    const sel = classes.find((c) => c.id === e.target.value);
                    setFormData({ ...formData, classId: e.target.value, className: sel?.name || 'SS 2' });
                  }}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                >
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Gender *</label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value as 'Male' | 'Female' })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Guardian Name *</label>
                <input
                  type="text"
                  required
                  value={formData.parentName}
                  onChange={(e) => setFormData({ ...formData, parentName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                  placeholder="e.g. Mr. Chukwu"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Guardian Phone *</label>
                <input
                  type="tel"
                  required
                  value={formData.parentPhone}
                  onChange={(e) => setFormData({ ...formData, parentPhone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                  placeholder="e.g. +234 803 123 4567"
                />
              </div>

              <div className="col-span-2 bg-amber-50 dark:bg-amber-950/40 p-3 rounded-2xl border border-amber-200 dark:border-amber-800/50 space-y-2">
                <div>
                  <label className="block font-bold text-amber-900 dark:text-amber-300 mb-1 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-amber-600" /> Result Access Passcode (Alphanumeric) *
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={formData.resultPasscode}
                      onChange={(e) => setFormData({ ...formData, resultPasscode: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-xl font-mono text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, resultPasscode: createAlphanumericCode() })}
                      className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-[11px] whitespace-nowrap"
                    >
                      Generate New
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-amber-900 dark:text-amber-300 mb-1 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-amber-600" /> Portal Sign-in Password *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-xl font-mono text-xs text-amber-900 dark:text-amber-200"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 flex justify-between">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold px-5 py-2 rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-6 py-2 rounded-xl text-xs shadow-md"
              >
                Save Student Record
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Student Profile Modal */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <form onSubmit={handleEditSubmit} className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-serif font-bold text-xl text-slate-900 dark:text-white flex items-center gap-2">
                <Edit className="w-5 h-5 text-amber-500" /> Edit Student Record
              </h3>
              <span className="font-mono text-xs font-bold text-amber-600">{editingStudent.admissionNo}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">First Name</label>
                <input
                  type="text"
                  required
                  value={editFormData.firstName || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, firstName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Last Name</label>
                <input
                  type="text"
                  required
                  value={editFormData.lastName || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, lastName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="col-span-2 bg-amber-50 dark:bg-amber-950/40 p-3 rounded-2xl border border-amber-200 dark:border-amber-800/50 space-y-2">
                <div>
                  <label className="block font-bold text-amber-900 dark:text-amber-300 mb-1 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-amber-600" /> Alphanumeric Result Passcode
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editFormData.resultPasscode || 'RES-8K9M2P'}
                      onChange={(e) => setEditFormData({ ...editFormData, resultPasscode: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-xl font-mono text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200"
                    />
                    <button
                      type="button"
                      onClick={() => setEditFormData({ ...editFormData, resultPasscode: createAlphanumericCode() })}
                      className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-[11px] whitespace-nowrap"
                    >
                      Regenerate
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-amber-900 dark:text-amber-300 mb-1 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-amber-600" /> Portal Login Password
                  </label>
                  <input
                    type="text"
                    value={editFormData.password || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-xl font-mono text-xs text-amber-900 dark:text-amber-200"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 flex justify-between">
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold px-5 py-2 rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-6 py-2 rounded-xl text-xs shadow-md"
              >
                Update Profile
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Printable Result Access Passcode Slips Modal */}
      {showPasscodeSlipsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-3xl w-full space-y-6 shadow-2xl my-8">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <h3 className="font-serif font-bold text-xl text-slate-900 dark:text-white flex items-center gap-2">
                  <Key className="w-5 h-5 text-amber-500" /> Official Result Access Passcode Slips
                </h3>
                <p className="text-xs text-slate-500">Distribution cards for students and parents to access terminal report cards.</p>
              </div>

              <button
                onClick={() => window.print()}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-sm"
              >
                <Printer className="w-4 h-4" /> Print All Slips
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto p-2">
              {students.map((std) => (
                <div key={std.id} className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border-2 border-dashed border-amber-300 dark:border-amber-800 space-y-3 relative">
                  <div className="flex items-center justify-between">
                    <span className="font-serif font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                      DIVINE ACADEMY SECONDARY SCHOOL
                    </span>
                    <span className="text-[10px] font-bold text-amber-600 bg-amber-100 dark:bg-amber-950 px-2 py-0.5 rounded-full">
                      Result Scratch Card
                    </span>
                  </div>

                  <div className="text-xs space-y-0.5">
                    <p className="font-bold text-slate-900 dark:text-white text-sm">{std.firstName} {std.lastName}</p>
                    <p className="text-slate-500 font-mono text-[11px]">Adm No: {std.admissionNo} • {std.className}</p>
                  </div>

                  <div className="bg-slate-900 text-white p-3 rounded-xl text-center space-y-1">
                    <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Alphanumeric Passcode:</p>
                    <p className="font-mono font-black text-lg tracking-widest text-amber-300">
                      {std.resultPasscode || 'RES-8K9M2P'}
                    </p>
                  </div>

                  <p className="text-[9px] text-slate-400 text-center italic">
                    Keep confidential. Enter passcode on student portal to view report card.
                  </p>
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowPasscodeSlipsModal(false)}
                className="bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold px-6 py-2 rounded-xl text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

