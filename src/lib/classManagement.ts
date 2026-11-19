import type {
  Assignment,
  AttendanceRecord,
  CBTExam,
  SchoolClass,
  ScoreRecord,
  Student,
  StudyNote,
  Teacher,
  TerminalResult,
} from '../types';

export type ClassCategory = SchoolClass['category'];

export interface StandardClassPreset {
  name: string;
  category: ClassCategory;
  defaultArms: string[];
  defaultCapacity: number;
}

/**
 * Standard Nigerian secondary school class structure (JSS 1–3, SS 1–3).
 * Used as optional quick-create templates and sorting anchors — never auto-inserted.
 */
export const NIGERIAN_SECONDARY_CLASS_PRESETS: readonly StandardClassPreset[] = [
  { name: 'JSS 1', category: 'Junior Secondary', defaultArms: ['A', 'B'], defaultCapacity: 35 },
  { name: 'JSS 2', category: 'Junior Secondary', defaultArms: ['A', 'B'], defaultCapacity: 35 },
  { name: 'JSS 3', category: 'Junior Secondary', defaultArms: ['A', 'B'], defaultCapacity: 35 },
  {
    name: 'SS 1',
    category: 'Senior Secondary',
    defaultArms: ['Science', 'Arts', 'Commercial'],
    defaultCapacity: 35,
  },
  {
    name: 'SS 2',
    category: 'Senior Secondary',
    defaultArms: ['Science', 'Arts', 'Commercial'],
    defaultCapacity: 35,
  },
  {
    name: 'SS 3',
    category: 'Senior Secondary',
    defaultArms: ['Science', 'Arts', 'Commercial'],
    defaultCapacity: 35,
  },
];

export const VALID_CLASS_CATEGORIES: readonly ClassCategory[] = [
  'Junior Secondary',
  'Senior Secondary',
];

export interface ClassDependencyCounts {
  students: number;
  scores: number;
  terminalResults: number;
  attendance: number;
  cbtExams: number;
  assignments: number;
  studyNotes: number;
  formTeachers: number;
  totalLinked: number;
}

/**
 * Trims surrounding whitespace and collapses repeated internal whitespace.
 * Example: "  JSS   1 " -> "JSS 1".
 */
export function normalizeClassName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

/**
 * Canonical case-insensitive key used for duplicate class detection.
 * Example: "JSS 1", "jss 1", "JSS  1" -> "jss 1".
 */
export function canonicalClassKey(raw: string): string {
  return normalizeClassName(raw).toLowerCase();
}

/**
 * Infers Nigerian secondary school category from a class name prefix when clear.
 */
export function inferClassCategory(name: string): ClassCategory | null {
  const normalized = normalizeClassName(name);
  if (/^jss\b|^js\s*\d/i.test(normalized)) {
    return 'Junior Secondary';
  }
  if (/^ss\b|^sss\b/i.test(normalized)) {
    return 'Senior Secondary';
  }
  return null;
}

/**
 * Parses a comma-separated arms string (e.g. "A, B, C" or "Science, Arts")
 * into a deduplicated array of non-empty labels.
 */
export function parseArmsInput(raw: string | string[]): string[] {
  const items = Array.isArray(raw) ? raw : raw.split(',');
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of items) {
    const cleaned = String(item).trim().replace(/\s+/g, ' ');
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
  }

  return result;
}

/**
 * Generates a unique text primary key for `public.classes.id` that never
 * collides with existing class IDs.
 */
export function generateClassId(name: string, existingIds: Iterable<string>): string {
  const used = new Set(existingIds);
  const slug = normalizeClassName(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const base = slug ? `cls-${slug}` : `cls-${Date.now()}`;
  if (!used.has(base)) {
    return base;
  }

  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) {
    suffix += 1;
  }
  return `${base}-${suffix}`;
}

/**
 * Sorts classes in natural Nigerian secondary school order (JSS 1 -> JSS 3 -> SS 1 -> SS 3),
 * followed by additional Junior Secondary classes, then Senior Secondary classes.
 */
export function sortSchoolClasses(classes: SchoolClass[]): SchoolClass[] {
  const presetOrder = new Map<string, number>(
    NIGERIAN_SECONDARY_CLASS_PRESETS.map((preset, index) => [canonicalClassKey(preset.name), index])
  );

  return [...classes].sort((a, b) => {
    const rankA = presetOrder.get(canonicalClassKey(a.name));
    const rankB = presetOrder.get(canonicalClassKey(b.name));
    if (rankA !== undefined && rankB !== undefined) return rankA - rankB;
    if (rankA !== undefined) return -1;
    if (rankB !== undefined) return 1;

    if (a.category !== b.category) {
      return a.category === 'Junior Secondary' ? -1 : 1;
    }

    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });
}

export interface ClassValidationSuccess {
  ok: true;
  sanitized: Omit<SchoolClass, 'id'>;
}

export interface ClassValidationFailure {
  ok: false;
  error: string;
}

export type ClassValidationResult = ClassValidationSuccess | ClassValidationFailure;

export function isClassValidationFailure(
  result: ClassValidationResult
): result is ClassValidationFailure {
  return result.ok === false;
}

/**
 * Validates class payload against all `public.classes` database constraints:
 * - non-empty unique `name` (`uq_classes_name`, checked case-insensitively)
 * - valid `category` (`chk_classes_category`)
 * - positive integer `capacity` (`chk_classes_capacity`)
 * - array `arms` (`chk_classes_arms_array`)
 * - optional `classTeacherId` referencing an existing teacher (`fk_classes_class_teacher`)
 */
export function validateClassInput(
  input: {
    name: string;
    category: string;
    arms: string[] | string;
    classTeacherId?: string;
    capacity: number | string;
  },
  existingClasses: SchoolClass[],
  options?: {
    excludeId?: string;
    validTeacherIds?: ReadonlySet<string>;
  }
): ClassValidationResult {
  const normalizedName = normalizeClassName(input.name || '');
  if (!normalizedName) {
    return { ok: false, error: 'Class name is required (for example: JSS 1, JSS 2, SS 1).' };
  }

  if (normalizedName.length > 80) {
    return { ok: false, error: 'Class name must be 80 characters or fewer.' };
  }

  const targetKey = canonicalClassKey(normalizedName);
  const duplicate = existingClasses.find(
    (c) => c.id !== options?.excludeId && canonicalClassKey(c.name) === targetKey
  );
  if (duplicate) {
    return {
      ok: false,
      error: `A class named "${duplicate.name}" already exists. Duplicate class records are not allowed.`,
    };
  }

  if (input.category !== 'Junior Secondary' && input.category !== 'Senior Secondary') {
    return {
      ok: false,
      error: 'Class category must be either "Junior Secondary" or "Senior Secondary".',
    };
  }

  const parsedCapacity =
    typeof input.capacity === 'number' ? input.capacity : Number(String(input.capacity).trim());
  if (!Number.isFinite(parsedCapacity) || !Number.isInteger(parsedCapacity) || parsedCapacity <= 0) {
    return {
      ok: false,
      error: 'Class capacity must be a positive whole number greater than 0.',
    };
  }

  if (parsedCapacity > 500) {
    return {
      ok: false,
      error: 'Class capacity cannot exceed 500 students per class.',
    };
  }

  const sanitizedArms = parseArmsInput(input.arms);
  const rawTeacherId = input.classTeacherId?.trim() || undefined;
  if (rawTeacherId && options?.validTeacherIds && !options.validTeacherIds.has(rawTeacherId)) {
    return {
      ok: false,
      error: 'Selected class teacher could not be found. Please choose an active teacher or leave unassigned.',
    };
  }

  return {
    ok: true,
    sanitized: {
      name: normalizedName,
      category: input.category,
      arms: sanitizedArms,
      classTeacherId: rawTeacherId,
      capacity: parsedCapacity,
    },
  };
}

/**
 * Counts every school record referencing `classId` across all tables with FKs to `public.classes(id)`.
 */
export function countClassDependencies(
  classId: string,
  collections: {
    students: Student[];
    scores: ScoreRecord[];
    results: TerminalResult[];
    attendance: AttendanceRecord[];
    cbtExams: CBTExam[];
    assignments: Assignment[];
    studyNotes: StudyNote[];
    teachers: Teacher[];
  }
): ClassDependencyCounts {
  const students = collections.students.filter((s) => s.classId === classId).length;
  const scores = collections.scores.filter((s) => s.classId === classId).length;
  const terminalResults = collections.results.filter((r) => r.classId === classId).length;
  const attendance = collections.attendance.filter((a) => a.classId === classId).length;
  const cbtExams = collections.cbtExams.filter((e) => e.classId === classId).length;
  const assignments = collections.assignments.filter((a) => a.classId === classId).length;
  const studyNotes = collections.studyNotes.filter((n) => n.classId === classId).length;
  const formTeachers = collections.teachers.filter((t) => t.formClassId === classId).length;

  return {
    students,
    scores,
    terminalResults,
    attendance,
    cbtExams,
    assignments,
    studyNotes,
    formTeachers,
    totalLinked:
      students +
      scores +
      terminalResults +
      attendance +
      cbtExams +
      assignments +
      studyNotes +
      formTeachers,
  };
}

export function formatClassDependencyError(
  className: string,
  counts: ClassDependencyCounts
): string {
  const parts: string[] = [];
  if (counts.students > 0) {
    parts.push(`${counts.students} student${counts.students === 1 ? '' : 's'}`);
  }
  if (counts.scores > 0) {
    parts.push(`${counts.scores} score record${counts.scores === 1 ? '' : 's'}`);
  }
  if (counts.terminalResults > 0) {
    parts.push(`${counts.terminalResults} terminal result${counts.terminalResults === 1 ? '' : 's'}`);
  }
  if (counts.attendance > 0) {
    parts.push(`${counts.attendance} attendance record${counts.attendance === 1 ? '' : 's'}`);
  }
  if (counts.cbtExams > 0) {
    parts.push(`${counts.cbtExams} CBT exam${counts.cbtExams === 1 ? '' : 's'}`);
  }
  if (counts.assignments > 0) {
    parts.push(`${counts.assignments} assignment${counts.assignments === 1 ? '' : 's'}`);
  }
  if (counts.studyNotes > 0) {
    parts.push(`${counts.studyNotes} study note${counts.studyNotes === 1 ? '' : 's'}`);
  }
  if (counts.formTeachers > 0) {
    parts.push(`${counts.formTeachers} assigned form teacher${counts.formTeachers === 1 ? '' : 's'}`);
  }

  if (parts.length === 0) {
    return `Cannot delete "${className}" because it is linked to existing school records.`;
  }

  return `Cannot delete "${className}" because it is linked to ${parts.join(', ')}. Reassign or remove linked records first.`;
}

/**
 * Translates PostgreSQL / PostgREST error codes on `public.classes` into clear admin messages.
 */
export function formatSupabaseClassError(
  rawMessage: string,
  code?: string,
  className?: string
): string {
  const msg = rawMessage || '';

  if (code === '23505' || /uq_classes_name|duplicate key/i.test(msg)) {
    return className
      ? `A class named "${className}" already exists in Supabase. Duplicate class records are not allowed.`
      : 'A class with that name already exists in Supabase. Duplicate class records are not allowed.';
  }

  if (code === '23503' || /foreign key constraint/i.test(msg)) {
    if (/fk_classes_class_teacher/i.test(msg)) {
      return 'The selected class teacher does not exist in Supabase. Refresh faculty records and try again.';
    }
    return className
      ? `Cannot delete "${className}" because it is referenced by students or other school records in Supabase.`
      : 'This operation is blocked by linked student or school records in Supabase.';
  }

  if (code === '23514' || /check constraint/i.test(msg)) {
    if (/chk_classes_category/i.test(msg)) {
      return 'Class category must be "Junior Secondary" or "Senior Secondary".';
    }
    if (/chk_classes_capacity/i.test(msg)) {
      return 'Class capacity must be greater than 0.';
    }
    if (/chk_classes_arms_array/i.test(msg)) {
      return 'Class arms must be a valid list.';
    }
  }

  if (code === '42501' || /row-level security|permission denied/i.test(msg)) {
    return 'Permission denied by Supabase security policy. Please confirm you are signed in with an active administrator account.';
  }

  return msg || 'Database operation failed. Please check your connection and try again.';
}
