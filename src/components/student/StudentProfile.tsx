import React from 'react';
import { Student } from '../../types';
import { User, Award, ShieldCheck, Mail, Phone, Home, Heart } from 'lucide-react';

export const StudentProfile: React.FC<{ student: Student }> = ({ student }) => {
  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 shadow-xl space-y-6">
        
        {/* Profile Header */}
        <div className="flex flex-col sm:flex-row items-center gap-6 border-b border-slate-200 dark:border-slate-800 pb-6 text-center sm:text-left">
          <img
            src={student.avatar}
            alt={student.firstName}
            className="w-28 h-28 rounded-2xl object-cover border-4 border-amber-400 shadow-xl"
          />
          <div className="space-y-1">
            <span className="bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold text-xs px-3 py-1 rounded-full uppercase">
              {student.className} ({student.arm} Arm)
            </span>
            <h2 className="font-serif font-bold text-2xl text-slate-900 dark:text-white">
              {student.firstName} {student.lastName} {student.otherNames || ''}
            </h2>
            <p className="text-xs text-slate-500 font-mono">Admission No: {student.admissionNo}</p>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
          
          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
            <h4 className="font-bold uppercase text-slate-500 text-[10px]">Academic Details</h4>
            <p><strong>Current Class:</strong> {student.className}</p>
            <p><strong>House:</strong> {student.house} House</p>
            <p><strong>Gender:</strong> {student.gender}</p>
            <p><strong>Date of Birth:</strong> {student.dob}</p>
            <p><strong>Academic Status:</strong> <span className="text-emerald-600 font-bold">{student.status}</span></p>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
            <h4 className="font-bold uppercase text-slate-500 text-[10px]">Guardian & Emergency Contact</h4>
            <p><strong>Guardian Name:</strong> {student.parentName}</p>
            <p><strong>Guardian Phone:</strong> {student.parentPhone}</p>
            <p><strong>Guardian Email:</strong> {student.parentEmail}</p>
            <p><strong>Home Address:</strong> {student.address}</p>
          </div>

        </div>

      </div>
    </div>
  );
};
