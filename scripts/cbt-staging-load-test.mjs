/**
 * NON-DESTRUCTIVE STAGING LOAD TEST FOR DIVINE ACADEMY CBT SYSTEM
 *
 * SAFETY NOTICE:
 * - Never run this against live production exams or real student accounts.
 * - Requires explicit staging environment variables and `CONFIRM_STAGING_TEST=true`.
 * - Simulates batches of 5, 10, 20, or 30 test student accounts exercising:
 *     1. student-auth-login
 *     2. start_cbt_exam
 *     3. save_cbt_exam_answers (incremental draft saves)
 *     4. submit_cbt_exam
 *
 * Usage example:
 *   CONFIRM_STAGING_TEST=true \
 *   TEST_SUPABASE_URL="https://YOUR_STAGING_OR_TEST_REF.supabase.co" \
 *   TEST_SUPABASE_ANON_KEY="YOUR_ANON_KEY" \
 *   TEST_EXAM_ID="cbt-test-exam-id" \
 *   TEST_BATCH_SIZE=30 \
 *   TEST_STUDENT_CREDENTIALS_JSON='[{"admissionNo":"TEST/001","password":"..."}]' \
 *   node scripts/cbt-staging-load-test.mjs
 */

const assertStagingEnv = () => {
  if (process.env.CONFIRM_STAGING_TEST !== 'true') {
    console.error(
      'Aborted: Set CONFIRM_STAGING_TEST=true and use isolated staging/test student accounts and a dedicated test exam ID only.'
    );
    process.exit(1);
  }

  const required = [
    'TEST_SUPABASE_URL',
    'TEST_SUPABASE_ANON_KEY',
    'TEST_EXAM_ID',
    'TEST_STUDENT_CREDENTIALS_JSON',
  ];
  for (const key of required) {
    if (!process.env[key]) {
      console.error(`Missing required staging env var: ${key}`);
      process.exit(1);
    }
  }
};

const percentile = (sorted, p) => {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
};

async function callRpc(baseUrl, anonKey, jwt, fnName, body) {
  const t0 = performance.now();
  const res = await fetch(`${baseUrl}/rest/v1/rpc/${fnName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify(body),
  });
  const ms = performance.now() - t0;
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { ok: res.ok, status: res.status, ms, data: json };
}

async function runStudentFlow(baseUrl, anonKey, examId, cred) {
  const timings = { loginMs: 0, startMs: 0, saveMs: [], submitMs: 0 };

  // 1. Login via student-auth-login
  const loginStart = performance.now();
  const loginRes = await fetch(`${baseUrl}/functions/v1/student-auth-login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify({
      admissionNo: cred.admissionNo,
      password: cred.password,
    }),
  });
  timings.loginMs = performance.now() - loginStart;
  const loginData = await loginRes.json();
  if (!loginRes.ok || !loginData?.session?.access_token) {
    throw new Error(`Login failed (${loginRes.status}) for ${cred.admissionNo}`);
  }
  const jwt = loginData.session.access_token;

  // 2. Start exam session
  const startRes = await callRpc(baseUrl, anonKey, jwt, 'start_cbt_exam', {
    p_exam_id: examId,
  });
  timings.startMs = startRes.ms;
  if (!startRes.ok || !Array.isArray(startRes.data?.exam?.questions)) {
    throw new Error(
      `start_cbt_exam failed (${startRes.status}) for ${cred.admissionNo}: ${JSON.stringify(startRes.data)}`
    );
  }

  // 3. Simulate incremental draft saves every 15 questions
  const questions = startRes.data.exam.questions;
  const draftAnswers = {};
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const slot = ['A', 'B', 'C', 'D'][i % 4];
    if (q.optionIds?.[slot]) {
      draftAnswers[q.id] = q.optionIds[slot];
    }
    if ((i + 1) % 15 === 0 || i === questions.length - 1) {
      const saveRes = await callRpc(baseUrl, anonKey, jwt, 'save_cbt_exam_answers', {
        p_exam_id: examId,
        p_answers: draftAnswers,
      });
      timings.saveMs.push(saveRes.ms);
      if (!saveRes.ok) {
        throw new Error(
          `save_cbt_exam_answers failed (${saveRes.status}) for ${cred.admissionNo}`
        );
      }
    }
  }

  // 4. Submit exam
  const submitRes = await callRpc(baseUrl, anonKey, jwt, 'submit_cbt_exam', {
    p_exam_id: examId,
    p_answers: draftAnswers,
  });
  timings.submitMs = submitRes.ms;
  if (!submitRes.ok || !submitRes.data?.attempt?.id) {
    throw new Error(
      `submit_cbt_exam failed (${submitRes.status}) for ${cred.admissionNo}: ${JSON.stringify(submitRes.data)}`
    );
  }

  return timings;
}

async function main() {
  assertStagingEnv();
  const baseUrl = process.env.TEST_SUPABASE_URL.replace(/\/+$/, '');
  const anonKey = process.env.TEST_SUPABASE_ANON_KEY;
  const examId = process.env.TEST_EXAM_ID;
  const batchSize = Math.max(1, Number(process.env.TEST_BATCH_SIZE || 30));
  const creds = JSON.parse(process.env.TEST_STUDENT_CREDENTIALS_JSON).slice(0, batchSize);

  console.log(`Running staging CBT load test for ${creds.length} concurrent student(s) on ${examId}...`);
  const t0 = performance.now();
  const outcomes = await Promise.allSettled(
    creds.map((cred) => runStudentFlow(baseUrl, anonKey, examId, cred))
  );
  const totalMs = performance.now() - t0;

  const passed = outcomes.filter((o) => o.status === 'fulfilled').map((o) => o.value);
  const failed = outcomes.filter((o) => o.status === 'rejected').map((o) => o.reason?.message || String(o.reason));

  const summarize = (arr) => {
    const sorted = [...arr].sort((a, b) => a - b);
    return {
      p50: `${percentile(sorted, 50).toFixed(0)}ms`,
      p95: `${percentile(sorted, 95).toFixed(0)}ms`,
      max: `${(sorted[sorted.length - 1] || 0).toFixed(0)}ms`,
    };
  };

  console.log('\n--- STAGING CBT LOAD TEST REPORT ---');
  console.log(`Total Students: ${creds.length}, Succeeded: ${passed.length}, Failed: ${failed.length}`);
  console.log(`Total Wall Time: ${totalMs.toFixed(0)}ms`);
  console.log('Login Latency:', summarize(passed.map((t) => t.loginMs)));
  console.log('Start Exam Latency:', summarize(passed.map((t) => t.startMs)));
  console.log('Draft Save Latency:', summarize(passed.flatMap((t) => t.saveMs)));
  console.log('Submit Exam Latency:', summarize(passed.map((t) => t.submitMs)));

  if (failed.length > 0) {
    console.error('\nFailures:', failed);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
