import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  doesStudentClassMatch,
  formatAcademicPersistenceError,
  resolveMatchingTeacher,
  resolveSyncedSelectionId,
  validateAcademicEntityReferences,
} from '../src/lib/academicSelection';
import type { SchoolClass, Subject, Teacher, User } from '../src/types';

function runTests() {
  let passedCount = 0;
  const test = (name: string, fn: () => void) => {
    fn();
    passedCount += 1;
    console.log(`PASS: ${name}`);
  };

  const liveClasses: SchoolClass[] = [
    {
      id: 'cls-jss-1',
      name: 'JSS 1',
      category: 'Junior Secondary',
      arms: ['A', 'B'],
      capacity: 35,
    },
    {
      id: 'cls-ss-2',
      name: 'SS 2',
      category: 'Senior Secondary',
      arms: ['Science', 'Arts'],
      capacity: 35,
    },
  ];

  const liveSubjects: Subject[] = [
    {
      id: 'sub-171000001',
      code: 'MTH101',
      name: 'Mathematics',
      category: 'General',
      isCompulsory: true,
    },
    {
      id: 'sub-171000002',
      code: 'PHY201',
      name: 'Physics',
      category: 'Science',
      isCompulsory: false,
    },
  ];

  const teachers: Teacher[] = [
    {
      id: 'tch-171000001',
      authUserId: 'auth-uuid-1',
      staffId: 'DA/STF/001',
      firstName: 'Adebayo',
      lastName: 'Ogunleye',
      email: 'adebayo@divineacademy.edu.ng',
      phone: '08012345678',
      subjectIds: ['sub-171000001'],
      subjectsTaught: ['Mathematics'],
      formClassId: 'cls-ss-2',
      formClassName: 'SS 2',
      classTaught: 'SS 2',
      classesTaught: ['SS 2'],
      avatar: '',
      status: 'Active',
    },
  ];

  // 1. resolveSyncedSelectionId replaces stale demo IDs with first live ID
  test('resolveSyncedSelectionId snaps stale c-ss2 / sub-mth IDs to live Supabase IDs', () => {
    assert.equal(resolveSyncedSelectionId('c-ss2', liveClasses), 'cls-jss-1');
    assert.equal(resolveSyncedSelectionId('sub-mth', liveSubjects), 'sub-171000001');
    assert.equal(resolveSyncedSelectionId('', liveClasses), 'cls-jss-1');

    // Valid existing selection is preserved
    assert.equal(resolveSyncedSelectionId('cls-ss-2', liveClasses), 'cls-ss-2');
    assert.equal(resolveSyncedSelectionId('sub-171000002', liveSubjects), 'sub-171000002');

    // Study notes 'all' option is preserved when allowAll=true
    assert.equal(resolveSyncedSelectionId('all', liveClasses, { allowAll: true }), 'all');
    assert.equal(resolveSyncedSelectionId('', [], { allowAll: true }), 'all');

    // Edit mode preserves an existing record's ID while lists load unless invalid
    assert.equal(
      resolveSyncedSelectionId('cls-legacy', [], { preserveExistingWhenEditing: true }),
      'cls-legacy'
    );

    // Empty list without preserve returns empty string
    assert.equal(resolveSyncedSelectionId('c-ss2', []), '');
  });

  // 2. resolveMatchingTeacher matches reliably across authUserId, id, referenceId/staffId, email, and name
  test('resolveMatchingTeacher resolves teacher profile via authUserId, staffId, email, and name', () => {
    const byAuth: User = {
      id: 'auth-uuid-1',
      authUserId: 'auth-uuid-1',
      name: 'Other Name',
      email: 'other@divineacademy.edu.ng',
      role: 'teacher',
    };
    assert.equal(resolveMatchingTeacher(byAuth, teachers)?.id, 'tch-171000001');

    const byStaffId: User = {
      id: 'u-2',
      name: 'Other',
      email: 'other@divineacademy.edu.ng',
      role: 'teacher',
      referenceId: 'da/stf/001',
    };
    assert.equal(resolveMatchingTeacher(byStaffId, teachers)?.id, 'tch-171000001');

    const byEmail: User = {
      id: 'u-3',
      name: 'Other',
      email: 'ADEBAYO@divineacademy.edu.ng',
      role: 'teacher',
    };
    assert.equal(resolveMatchingTeacher(byEmail, teachers)?.id, 'tch-171000001');

    const byName: User = {
      id: 'u-4',
      name: 'Adebayo Ogunleye',
      email: 'none@divineacademy.edu.ng',
      role: 'teacher',
    };
    assert.equal(resolveMatchingTeacher(byName, teachers)?.id, 'tch-171000001');

    // Admin must not resolve as a teacher profile
    const adminUser: User = { ...byAuth, role: 'admin' };
    assert.equal(resolveMatchingTeacher(adminUser, teachers), undefined);
  });

  // 3. validateAcademicEntityReferences rejects stale IDs, empty directories, and unlinked teachers
  test('validateAcademicEntityReferences blocks invalid classId, subjectId, empty tables, and unlinked teachers', () => {
    const staleClassResult = validateAcademicEntityReferences({
      classId: 'c-ss2',
      subjectId: 'sub-171000001',
      classes: liveClasses,
      subjects: liveSubjects,
      currentUserRole: 'admin',
      actionLabel: 'create a CBT exam',
    });
    assert.equal(staleClassResult.ok, false);
    assert.ok(staleClassResult.error?.includes('c-ss2'));

    const emptySubjectsResult = validateAcademicEntityReferences({
      classId: 'cls-ss-2',
      subjectId: 'sub-171000001',
      classes: liveClasses,
      subjects: [],
      currentUserRole: 'admin',
      actionLabel: 'create a CBT exam',
    });
    assert.equal(emptySubjectsResult.ok, false);
    assert.ok(emptySubjectsResult.error?.includes('No subjects'));

    const unlinkedTeacherResult = validateAcademicEntityReferences({
      classId: 'cls-ss-2',
      subjectId: 'sub-171000001',
      classes: liveClasses,
      subjects: liveSubjects,
      currentUserRole: 'teacher',
      resolvedTeacherId: undefined,
      actionLabel: 'create a CBT exam',
    });
    assert.equal(unlinkedTeacherResult.ok, false);
    assert.ok(unlinkedTeacherResult.error?.includes('public.teachers'));

    const validTeacherResult = validateAcademicEntityReferences({
      classId: 'cls-ss-2',
      subjectId: 'sub-171000002',
      classes: liveClasses,
      subjects: liveSubjects,
      currentUserRole: 'teacher',
      resolvedTeacherId: 'tch-171000001',
    });
    assert.equal(validTeacherResult.ok, true);
    assert.equal(validTeacherResult.matchedClass?.name, 'SS 2');
    assert.equal(validTeacherResult.matchedSubject?.name, 'Physics');

    const studyNoteAllClasses = validateAcademicEntityReferences({
      classId: 'all',
      subjectId: 'sub-171000001',
      classes: liveClasses,
      subjects: liveSubjects,
      allowAllClass: true,
    });
    assert.equal(studyNoteAllClasses.ok, true);
    assert.equal(studyNoteAllClasses.matchedClass, undefined);
  });

  // 4. doesStudentClassMatch prevents "JSS 1".includes("SS 1") cross-class false positives
  test('doesStudentClassMatch avoids SS 1 matching JSS 1 and matches canonical className or classId', () => {
    const ss1Student = { classId: 'cls-ss-1', className: 'SS 1' };
    const ss2Student = { classId: 'cls-ss-2', className: 'SS 2' };

    assert.equal(doesStudentClassMatch('cls-jss-1', 'JSS 1', ss1Student), false);
    assert.equal(doesStudentClassMatch('cls-jss-2', 'JSS 2', ss2Student), false);
    assert.equal(doesStudentClassMatch(undefined, 'JSS 1', ss1Student), false);
    assert.equal(doesStudentClassMatch('cls-ss-1', 'SS 1', ss1Student), true);
    assert.equal(doesStudentClassMatch(undefined, 'ss 1', ss1Student), true);
    assert.equal(doesStudentClassMatch('cls-ss-1', 'Senior Secondary 1', ss1Student), true);
  });

  // 5. formatAcademicPersistenceError maps FK, unique, and RLS errors clearly
  test('formatAcademicPersistenceError translates PostgreSQL FK, unique, and RLS codes cleanly', () => {
    const fkClassMsg = formatAcademicPersistenceError(
      'CBT exam',
      'insert or update on table "cbt_exams" violates foreign key constraint "fk_cbt_exams_class"',
      '23503'
    );
    assert.ok(fkClassMsg.includes('public.classes'));

    const fkSubjectMsg = formatAcademicPersistenceError(
      'score',
      'violates foreign key constraint "fk_scores_subject"',
      '23503'
    );
    assert.ok(fkSubjectMsg.includes('public.subjects'));

    const dupCodeMsg = formatAcademicPersistenceError(
      'subject',
      'duplicate key value violates unique constraint "uq_subjects_code"',
      '23505'
    );
    assert.ok(dupCodeMsg.includes('Subject Code'));

    const rlsMsg = formatAcademicPersistenceError(
      'CBT exam',
      'new row violates row-level security policy for table "cbt_exams"',
      '42501'
    );
    assert.ok(rlsMsg.includes('security policy'));
  });

  // 6. Frontend hygiene: no hardcoded c-ss2 / sub-mth defaults in components, and audit SQL is single-statement read-only
  test('Frontend components contain zero hardcoded c-ss2 / sub-mth defaults and audit SQL is strictly read-only', () => {
    const componentsDir = path.resolve(process.cwd(), 'src/components');
    const walk = (dir: string): string[] =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        return entry.isDirectory() ? walk(full) : [full];
      });

    for (const file of walk(componentsDir)) {
      if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue;
      const src = fs.readFileSync(file, 'utf8');
      assert.equal(
        /['"]c-(?:ss|jss)[1-3]['"]|['"]sub-(?:mth|eng)['"]/.test(src),
        false,
        `Found hardcoded seed ID default in ${path.relative(process.cwd(), file)}`
      );
    }

    const auditSql = fs.readFileSync(
      path.resolve(process.cwd(), 'supabase/migrations/20260504_portal_compatibility_audit.sql'),
      'utf8'
    );
    const strippedComments = auditSql.replace(/--.*$/gm, '').trim();
    const strippedTokens = strippedComments.replace(/'(?:''|[^'])*'/g, "''").trim();
    assert.ok(strippedTokens.startsWith('WITH'));
    assert.ok(strippedTokens.endsWith(';'));
    assert.equal((strippedTokens.match(/;/g) || []).length, 1);
    assert.equal(
      /\b(?:CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|TRUNCATE|GRANT|REVOKE)\b/i.test(strippedTokens),
      false
    );
    assert.equal(/\bquery_to_xml\b/i.test(auditSql), false);
    assert.equal(/pg_catalog\.substring\s*\([^;]*\bFROM\b/i.test(auditSql), false);
  });

  console.log(`\nAll ${passedCount} academic compatibility tests passed.`);
}

runTests();
