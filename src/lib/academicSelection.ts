import type { SchoolClass, Student, Subject, Teacher, User, UserRole } from '../types';
import { canonicalClassKey } from './classManagement';

/**
 * Resolves a controlled dropdown selection ID against a live collection of
 * records (e.g. `classes` or `subjects`).
 *
 * Prevents stale demo/seed IDs (such as `'c-ss2'` or `'sub-mth'`) from remaining
 * in component state after Supabase loads live records with different IDs
 * (such as `'cls-jss-1'` or `'sub-171...'`), which otherwise causes visual/state
 * mismatch in HTML `<select>` elements and PostgreSQL FK violations on save.
 */
export function resolveSyncedSelectionId<T extends { id: string }>(
  currentId: string,
  items: readonly T[],
  options?: {
    allowAll?: boolean;
    preserveExistingWhenEditing?: boolean;
  }
): string {
  if (options?.allowAll && currentId === 'all') {
    return 'all';
  }

  if (currentId && items.some((item) => item.id === currentId)) {
    return currentId;
  }

  if (options?.preserveExistingWhenEditing && currentId) {
    return currentId;
  }

  if (items.length > 0) {
    return items[0].id;
  }

  if (options?.allowAll) {
    return 'all';
  }

  return '';
}

/**
 * Matches the authenticated portal user (when `role === 'teacher'`) against the
 * loaded `teachers` directory consistently across all teacher modules.
 */
export function resolveMatchingTeacher(
  currentUser: User | null | undefined,
  teachers: readonly Teacher[]
): Teacher | undefined {
  if (!currentUser || currentUser.role !== 'teacher') {
    return undefined;
  }

  const refLower = currentUser.referenceId?.trim().toLowerCase();
  const emailLower = currentUser.email?.trim().toLowerCase();
  const nameLower = currentUser.name?.trim().toLowerCase();

  return (
    teachers.find(
      (t) =>
        (Boolean(currentUser.authUserId) && t.authUserId === currentUser.authUserId) ||
        t.id === currentUser.id ||
        (Boolean(refLower) &&
          (t.id.toLowerCase() === refLower ||
            t.staffId?.trim().toLowerCase() === refLower)) ||
        (Boolean(emailLower) && t.email?.trim().toLowerCase() === emailLower)
    ) ||
    (nameLower
      ? teachers.find(
          (t) => `${t.firstName} ${t.lastName}`.trim().toLowerCase() === nameLower
        )
      : undefined)
  );
}

export interface AcademicReferenceValidationResult {
  ok: boolean;
  matchedClass?: SchoolClass;
  matchedSubject?: Subject;
  error?: string;
}

/**
 * Validates that selected `classId`, `subjectId`, and optional `teacherId`
 * resolve to real loaded records before writing to FK-constrained tables
 * (`cbt_exams`, `scores`, `assignments`, `study_notes`, `attendance`).
 */
export function validateAcademicEntityReferences(params: {
  classId?: string;
  subjectId?: string;
  classes: readonly SchoolClass[];
  subjects: readonly Subject[];
  allowAllClass?: boolean;
  requireSubject?: boolean;
  currentUserRole?: UserRole;
  resolvedTeacherId?: string;
  actionLabel?: string;
}): AcademicReferenceValidationResult {
  const action = params.actionLabel || 'save this record';
  const requireSubject = params.requireSubject !== false;
  const allowAllClass = Boolean(params.allowAllClass);

  let matchedClass: SchoolClass | undefined;
  const isAllClass = allowAllClass && (!params.classId || params.classId === 'all');

  if (!isAllClass) {
    if (params.classes.length === 0) {
      return {
        ok: false,
        error: `No classes are available in Class Management yet. Please ask an administrator to create classes before trying to ${action}.`,
      };
    }

    matchedClass = params.classes.find((c) => c.id === params.classId);
    if (!matchedClass) {
      return {
        ok: false,
        error: `The selected class ("${params.classId || 'none'}") does not match any active class record in Supabase. Please select a valid class and try again.`,
      };
    }
  }

  let matchedSubject: Subject | undefined;
  if (requireSubject) {
    if (params.subjects.length === 0) {
      return {
        ok: false,
        error: `No subjects are available in Curriculum & Subject Manager yet. Please ask an administrator to add subjects before trying to ${action}.`,
      };
    }

    matchedSubject = params.subjects.find((s) => s.id === params.subjectId);
    if (!matchedSubject) {
      return {
        ok: false,
        error: `The selected subject ("${params.subjectId || 'none'}") does not match any active subject record in Supabase. Please select a valid subject and try again.`,
      };
    }
  }

  if (params.currentUserRole === 'teacher' && !params.resolvedTeacherId) {
    return {
      ok: false,
      error:
        'Your teacher login account is not linked to an active faculty record in public.teachers. Please contact the school administrator to link your Staff ID and email.',
    };
  }

  return {
    ok: true,
    matchedClass,
    matchedSubject,
  };
}

/**
 * Exact class matcher for student views so "SS 1" never substring-matches "JSS 1".
 */
export function doesStudentClassMatch(
  recordClassId: string | undefined,
  recordClassName: string | undefined,
  student: Pick<Student, 'classId' | 'className'>
): boolean {
  if (recordClassId && student.classId && recordClassId === student.classId) {
    return true;
  }
  if (recordClassName && student.className) {
    return canonicalClassKey(recordClassName) === canonicalClassKey(student.className);
  }
  return false;
}

/**
 * Formats PostgreSQL / PostgREST errors for curriculum and academic tables
 * (`subjects`, `cbt_exams`, `scores`, `assignments`, `study_notes`, `attendance`)
 * into clear user-facing diagnostics.
 */
export function formatAcademicPersistenceError(
  entityLabel:
    | 'subject'
    | 'CBT exam'
    | 'score'
    | 'assignment'
    | 'study note'
    | 'attendance record',
  rawMessage: string,
  code?: string
): string {
  const msg = rawMessage || '';
  const lower = msg.toLowerCase();

  if (code === '23503' || lower.includes('foreign key constraint')) {
    if (
      lower.includes('fk_cbt_exams_class') ||
      lower.includes('fk_scores_class') ||
      lower.includes('fk_assignments_class') ||
      lower.includes('fk_study_notes_class') ||
      lower.includes('fk_attendance_class') ||
      lower.includes('fk_students_class')
    ) {
      return `The selected class does not exist in Supabase (public.classes). Refresh the page or verify Class Management before saving this ${entityLabel}.`;
    }
    if (
      lower.includes('fk_cbt_exams_subject') ||
      lower.includes('fk_scores_subject') ||
      lower.includes('fk_assignments_subject') ||
      lower.includes('fk_study_notes_subject')
    ) {
      return `The selected subject does not exist in Supabase (public.subjects). Add subjects in Curriculum & Subject Manager before saving this ${entityLabel}.`;
    }
    if (
      lower.includes('fk_cbt_exams_teacher') ||
      lower.includes('fk_scores_teacher') ||
      lower.includes('fk_assignments_teacher') ||
      lower.includes('fk_study_notes_teacher')
    ) {
      return `The assigned teacher profile could not be verified in Supabase (public.teachers). Please verify your faculty linkage and try again.`;
    }
    if (
      lower.includes('fk_scores_student') ||
      lower.includes('fk_attendance_student')
    ) {
      return `One or more referenced student records no longer exist in Supabase. Refresh the roster and try again.`;
    }
    return `Could not save ${entityLabel} because a linked class, subject, or user record is missing in Supabase.`;
  }

  if (code === '23505' || lower.includes('duplicate key') || lower.includes('unique constraint')) {
    if (lower.includes('uq_subjects_code')) {
      return 'A subject with that Subject Code already exists in Supabase.';
    }
    if (lower.includes('uq_subjects_name')) {
      return 'A subject with that Subject Name already exists in Supabase.';
    }
    return `A duplicate ${entityLabel} record already exists in Supabase.`;
  }

  if (code === '42501' || lower.includes('row-level security') || lower.includes('permission denied')) {
    return `Permission denied by Supabase security policy while saving this ${entityLabel}. Confirm your account role, active status, and assigned classes/subjects.`;
  }

  return msg || `Unable to save ${entityLabel} in Supabase.`;
}
