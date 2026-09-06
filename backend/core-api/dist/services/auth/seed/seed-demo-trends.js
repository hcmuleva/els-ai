import { config } from 'dotenv';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
config();
// ─────────────────────────────────────────────────────────────────────────────
// Demo "Growth Trends" seed.
//
// Creates 5 teacher + 5 parent + 5 student demo accounts and populates ~3 years
// of dynamic, trend-shaped data across the REAL backend tables that the Growth
// Trends report reads from:
//   • student_activity            (daily activity / consistency / quiz trend)
//   • student_attempts            (quiz score trend)
//   • student_analytics           (daily snapshot)
//   • classrooms + classroom_student_remarks  (teacher feedback trend, 1-5)
//   • student_achievements        (milestones)
//   • counseling_sessions + counseling_reports (counseling impact trend)
//   • parent_feedback             (parent sentiment trend)
//   • parent_assessments          (parent rating trend, 0-10)
//
// Idempotent: re-running is a no-op unless RESEED_DEMO_TRENDS=true (which first
// deletes the demo accounts, cascading their data, before reseeding).
// ─────────────────────────────────────────────────────────────────────────────
const PASSWORD = 'welcome';
const YEARS_BACK = 3;
const PROFILES = [
    {
        // Hero turnaround: weak start, small early gains, strong growth by year 1+.
        key: 'aarav', studentFirst: 'Aarav', studentLast: 'Sharma', studentEmail: 'demo.aarav@els.ai',
        classLevel: '3', parentFirst: 'Sunita', parentLast: 'Sharma', parentEmail: 'demo.parent.sharma@els.ai',
        base: 34, slope: 58, curve: 1.35, noise: 4, seasonal: 3, cycles: 2, dip: 0, subject: 'English',
    },
    {
        // Fast, fairly linear improver.
        key: 'diya', studentFirst: 'Diya', studentLast: 'Patel', studentEmail: 'demo.diya@els.ai',
        classLevel: '4', parentFirst: 'Rakesh', parentLast: 'Patel', parentEmail: 'demo.parent.patel@els.ai',
        base: 42, slope: 48, curve: 1.1, noise: 5, seasonal: 4, cycles: 2, dip: 0, subject: 'Mathematics',
    },
    {
        // Volatile but trending up over time.
        key: 'kabir', studentFirst: 'Kabir', studentLast: 'Khan', studentEmail: 'demo.kabir@els.ai',
        classLevel: '5', parentFirst: 'Imran', parentLast: 'Khan', parentEmail: 'demo.parent.khan@els.ai',
        base: 48, slope: 34, curve: 1.0, noise: 14, seasonal: 9, cycles: 3, dip: 0, subject: 'Science',
    },
    {
        // Mid-journey dip, then recovery to new highs.
        key: 'ananya', studentFirst: 'Ananya', studentLast: 'Reddy', studentEmail: 'demo.ananya@els.ai',
        classLevel: '6', parentFirst: 'Lakshmi', parentLast: 'Reddy', parentEmail: 'demo.parent.reddy@els.ai',
        base: 60, slope: 30, curve: 1.0, noise: 6, seasonal: 4, cycles: 2, dip: 24, subject: 'Social Science',
    },
    {
        // Steady, accelerating climb from the middle.
        key: 'vivaan', studentFirst: 'Vivaan', studentLast: 'Gupta', studentEmail: 'demo.vivaan@els.ai',
        classLevel: '8', parentFirst: 'Manoj', parentLast: 'Gupta', parentEmail: 'demo.parent.gupta@els.ai',
        base: 40, slope: 45, curve: 1.2, noise: 5, seasonal: 4, cycles: 2, dip: 0, subject: 'Mathematics',
    },
];
const TEACHERS = [
    { first: 'Meera', last: 'Iyer', email: 'demo.teacher.iyer@els.ai' },
    { first: 'Arjun', last: 'Nair', email: 'demo.teacher.nair@els.ai' },
    { first: 'Pooja', last: 'Joshi', email: 'demo.teacher.joshi@els.ai' },
    { first: 'Sanjay', last: 'Verma', email: 'demo.teacher.verma@els.ai' },
    { first: 'Neha', last: 'Desai', email: 'demo.teacher.desai@els.ai' },
];
// Single shared parent linked to EVERY demo student, so one parent login can
// demo all children via the student switcher.
const SHARED_PARENT = { first: 'Demo', last: 'Parent', email: 'demo.parent@els.ai' };
// Remark pools ordered as a journey: early terms read as "needs work" with a
// concrete recommendation, mid terms acknowledge the recommendation working,
// later terms celebrate the transformation.
const NEEDS_WORK_REMARKS = [
    'Struggling with the basics this term. Recommended 15 mins of daily practice and extra worksheets to build a foundation.',
    'Easily distracted and homework is often incomplete. Suggested a fixed study slot at home and short daily quizzes.',
    'Below expected level on new concepts. Advised parents on a structured revision plan and weekly check-ins.',
    'Attendance and participation need attention. Put a small-steps practice routine in place to get started.',
];
const NEUTRAL_REMARKS = [
    'The recommended daily practice is starting to help, small but steady gains this term.',
    'Following the suggested routine well, focus is improving and homework is more regular now.',
    'Noticeable effort since the support plan began, confidence is slowly building.',
    'Catching up on weak topics, participation in class is picking up nicely.',
];
const POSITIVE_REMARKS = [
    'Remarkable turnaround from earlier terms, now consistently completes tasks ahead of time.',
    'Has become one of the most confident participants, helps classmates during activities.',
    'Strong conceptual understanding now, asks thoughtful questions and rarely needs reminders.',
    'Excellent, self-driven learner this year, a great example of sustained improvement.',
];
const NEEDS_WORK_FEEDBACK = [
    'He was doing badly earlier; we have started the daily routine the teacher recommended.',
    'Struggling to stay consistent at home, following the suggested practice plan now.',
    'Low motivation these days, sticking with the recommended short daily quizzes.',
    'Having trouble with new topics, using the extra material the teacher shared.',
];
const NEUTRAL_FEEDBACK = [
    'The new routine is helping, seeing small improvements each week now.',
    'A bit more confident than before, the daily practice seems to be working.',
    'Homework is getting done with fewer reminders, slowly getting there.',
    'Starting to enjoy the quizzes on the app, gradual progress visible.',
];
const POSITIVE_FEEDBACK = [
    'Huge turnaround this year, so proud of the progress, thank you for the guidance!',
    'Finishes homework independently now and is excited about school.',
    'Big change in confidence compared to when we started, really happy.',
    'From struggling to thriving in a year, the recommendations made a real difference.',
];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
// Deterministic pseudo-random in [0,1) so reseeding is reproducible.
const rand = (n) => {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
};
function scoreFor(p, t, salt) {
    const seasonal = Math.sin(t * Math.PI * 2 * p.cycles) * p.seasonal;
    const dip = p.dip ? -p.dip * Math.exp(-Math.pow((t - 0.45) / 0.12, 2)) : 0;
    const noise = (rand(salt) - 0.5) * 2 * p.noise;
    return clamp(Math.round(p.base + p.slope * Math.pow(t, p.curve) + seasonal + dip + noise), 8, 100);
}
const pctTo5 = (pct) => clamp(Math.round(pct / 20), 1, 5);
const pick = (arr, i) => arr[((i % arr.length) + arr.length) % arr.length];
async function resolveOrgId() {
    const def = await db.query(`SELECT id FROM organizations WHERE is_default = true LIMIT 1`);
    if ((def.rowCount ?? 0) > 0)
        return def.rows[0].id;
    const els = await db.query(`SELECT id FROM organizations WHERE subdomain = 'els-academy' LIMIT 1`);
    return (els.rowCount ?? 0) > 0 ? els.rows[0].id : null;
}
async function upsertUser(orgId, passwordHash, first, last, email, role, classLevel) {
    const existing = await db.query(`SELECT id FROM users WHERE email = $1 LIMIT 1`, [email]);
    let userId;
    if ((existing.rowCount ?? 0) > 0) {
        userId = existing.rows[0].id;
        await db.query(`UPDATE users SET first_name=$2, last_name=$3, password_hash=$4, active_role=$5, class_level=$6, is_active=true, updated_at=NOW() WHERE id=$1`, [userId, first, last, passwordHash, role, classLevel]);
    }
    else {
        const created = await db.query(`INSERT INTO users(first_name, last_name, email, password_hash, active_role, class_level)
       VALUES($1,$2,$3,$4,$5,$6) RETURNING id`, [first, last, email, passwordHash, role, classLevel]);
        userId = created.rows[0].id;
    }
    const roleRow = await db.query(`SELECT id FROM roles WHERE role_name=$1 LIMIT 1`, [role]);
    if ((roleRow.rowCount ?? 0) > 0) {
        await db.query(`INSERT INTO user_roles(user_id, role_id, organization_id)
       VALUES($1,$2,$3) ON CONFLICT (user_id, role_id, organization_id) DO NOTHING`, [userId, roleRow.rows[0].id, orgId]);
    }
    return userId;
}
async function deleteDemoAccounts(teacherEmails) {
    const allEmails = [
        ...PROFILES.map((p) => p.studentEmail),
        ...PROFILES.map((p) => p.parentEmail),
        SHARED_PARENT.email,
        ...teacherEmails,
    ];
    // Classrooms reference created_by (teachers); remove them first so their
    // remarks / achievements cascade before we drop the users.
    await db.query(`DELETE FROM classrooms WHERE created_by IN (SELECT id FROM users WHERE email = ANY($1::text[]))`, [teacherEmails]);
    await db.query(`DELETE FROM users WHERE email = ANY($1::text[])`, [allEmails]);
}
async function getOrCreateAchievements(orgId) {
    let rows = (await db.query(`SELECT id FROM achievements WHERE is_global = true ORDER BY created_at NULLS LAST LIMIT 8`)).rows;
    if (rows.length === 0) {
        rows = (await db.query(`SELECT id FROM achievements WHERE organization_id=$1::uuid LIMIT 8`, [orgId])).rows;
    }
    if (rows.length === 0) {
        const demo = [
            ['Star Performer', '⭐', '#F59E0B'],
            ['Quick Learner', '⚡', '#3B82F6'],
            ['Team Player', '🤝', '#10B981'],
            ['Most Improved', '📈', '#8B5CF6'],
            ['Perfect Attendance', '📅', '#EF4444'],
        ];
        for (const [name, emoji, color] of demo) {
            try {
                const r = await db.query(`INSERT INTO achievements (organization_id, name, emoji, color, description, is_global)
           VALUES ($1,$2,$3,$4,$5,false) RETURNING id`, [orgId, name, emoji, color, `${name} award`]);
                rows.push({ id: r.rows[0].id });
            }
            catch {
                // achievements schema differs; skip granting non-fatally
            }
        }
    }
    return rows;
}
export async function seedDemoTrends(orgIdArg) {
    const orgId = orgIdArg ?? (await resolveOrgId());
    if (!orgId) {
        console.warn('[demo-trends] No organization found (els-academy). Run the base seed first.');
        return;
    }
    const reseed = process.env.RESEED_DEMO_TRENDS === 'true';
    const teacherEmails = TEACHERS.map((t) => t.email);
    const marker = await db.query(`SELECT id FROM users WHERE email = $1 LIMIT 1`, [PROFILES[0].studentEmail]);
    if ((marker.rowCount ?? 0) > 0 && !reseed) {
        console.log('[demo-trends] Demo accounts already present. Skipping (set RESEED_DEMO_TRENDS=true to rebuild).');
        return;
    }
    if (reseed) {
        console.log('[demo-trends] RESEED_DEMO_TRENDS=true — removing existing demo accounts...');
        await deleteDemoAccounts(teacherEmails);
    }
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    // Teachers
    const teacherIds = [];
    for (const t of TEACHERS) {
        teacherIds.push(await upsertUser(orgId, passwordHash, t.first, t.last, t.email, 'teacher', null));
    }
    const achievements = await getOrCreateAchievements(orgId);
    // Shared parent — linked to every student below so one login demos all kids.
    const sharedParentId = await upsertUser(orgId, passwordHash, SHARED_PARENT.first, SHARED_PARENT.last, SHARED_PARENT.email, 'parent', null);
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const start = new Date(today);
    start.setFullYear(start.getFullYear() - YEARS_BACK);
    const totalMs = today.getTime() - start.getTime();
    let counts = { activity: 0, attempts: 0, analytics: 0, classrooms: 0, remarks: 0, achievements: 0, counseling: 0, feedback: 0, assessments: 0 };
    // Quizzes available in this org (for real student_attempts rows)
    const quizRows = (await db.query(`SELECT id FROM quizzes WHERE organization_id=$1::uuid ORDER BY created_at LIMIT 30`, [orgId])).rows;
    for (let pi = 0; pi < PROFILES.length; pi++) {
        const p = PROFILES[pi];
        const studentId = await upsertUser(orgId, passwordHash, p.studentFirst, p.studentLast, p.studentEmail, 'student', p.classLevel);
        const parentId = await upsertUser(orgId, passwordHash, p.parentFirst, p.parentLast, p.parentEmail, 'parent', null);
        await db.query(`INSERT INTO parent_student_links(parent_user_id, student_user_id, organization_id)
       VALUES($1,$2,$3) ON CONFLICT (parent_user_id, student_user_id, organization_id) DO NOTHING`, [parentId, studentId, orgId]);
        // also link the shared demo parent to this student
        await db.query(`INSERT INTO parent_student_links(parent_user_id, student_user_id, organization_id)
       VALUES($1,$2,$3) ON CONFLICT (parent_user_id, student_user_id, organization_id) DO NOTHING`, [sharedParentId, studentId, orgId]);
        // ── Daily activity (drives day/week/month engagement + consistency trend) ──
        // Day-level rows make the Week (days) and Month (weeks) drill-downs meaningful;
        // scores still follow each profile's growth arc via scoreFor(t).
        // The most-recent DENSE_DAYS window is fully populated EVERY day (content +
        // quiz + a real quiz attempt + analytics) so the latest week and latest month
        // are demo-ready with complete daily detail at every drill-down level.
        const DAY = 24 * 3600 * 1000;
        const DENSE_DAYS = 40;
        const denseFromMs = today.getTime() - DENSE_DAYS * DAY;
        const days = Math.max(1, Math.floor(totalMs / DAY));
        for (let dN = 0; dN <= days; dN++) {
            const date = new Date(start.getTime() + dN * DAY);
            if (date > today)
                break;
            const dense = date.getTime() >= denseFromMs;
            const dow = date.getDay();
            const salt = pi * 6000 + dN;
            // mostly school days, with the odd weekend study session (dense window = every day)
            if (!dense && (dow === 0 || dow === 6) && rand(salt) > 0.35)
                continue;
            const t = dN / days;
            const dateStr = date.toISOString().slice(0, 10);
            let dayAttempted = 0;
            let dayCompleted = 0;
            let dayTime = 0;
            // content study session on most days (every day in the dense window)
            if (dense || rand(salt + 1) > 0.15) {
                const ts = 240 + Math.round(rand(salt + 2) * 600);
                await db.query(`INSERT INTO student_activity(student_id, organization_id, activity_type, reference_title, status, score, time_spent_seconds, activity_date, created_at)
           VALUES($1,$2,'content',$3,'completed',NULL,$4,$5::date,$6)`, [studentId, orgId, `${p.subject} lesson`, ts, dateStr, date]);
                counts.activity++;
                dayAttempted++;
                dayCompleted++;
                dayTime += ts;
            }
            // quiz a few times a week (every day in the dense window)
            if (dense || rand(salt + 3) > 0.55) {
                const qscore = scoreFor(p, t, salt + 4);
                const isDone = dense || rand(salt + 5) > 0.12;
                const ts = 150 + Math.round(rand(salt + 6) * 300);
                await db.query(`INSERT INTO student_activity(student_id, organization_id, activity_type, reference_title, status, score, time_spent_seconds, activity_date, created_at)
           VALUES($1,$2,'quiz',$3,$4,$5,$6,$7::date,$8)`, [studentId, orgId, `${p.subject} quiz`, isDone ? 'completed' : 'attempted', qscore, ts, dateStr, date]);
                counts.activity++;
                dayAttempted++;
                if (isDone)
                    dayCompleted++;
                dayTime += ts;
                // real attempt so the academic line is detailed day-by-day in the dense window
                if (dense && quizRows.length > 0) {
                    const quizId = pick(quizRows, dN + pi).id;
                    await db.query(`INSERT INTO student_attempts(student_id, quiz_id, score, total_points, completed_at)
             VALUES($1,$2,$3,100,$4)`, [studentId, quizId, qscore, date]);
                    counts.attempts++;
                }
            }
            // occasional assignment
            if (rand(salt + 7) > 0.86) {
                const ts = 360 + Math.round(rand(salt + 9) * 500);
                await db.query(`INSERT INTO student_activity(student_id, organization_id, activity_type, reference_title, status, score, time_spent_seconds, activity_date, created_at)
           VALUES($1,$2,'assignment',$3,'completed',$4,$5,$6::date,$7)`, [studentId, orgId, `${p.subject} worksheet`, scoreFor(p, t, salt + 8), ts, dateStr, date]);
                counts.activity++;
                dayAttempted++;
                dayCompleted++;
                dayTime += ts;
            }
            // daily analytics snapshot — drives the attendance / consistency / completion
            // trend at every drill-down level (day → week → month → year).
            if (dayAttempted > 0) {
                const consistency = scoreFor(p, t, salt + 11); // follows the growth arc
                const completionRate = clamp(scoreFor(p, t, salt + 12), 35, 100);
                await db.query(`INSERT INTO student_analytics(student_id, organization_id, analytics_date, streak_days, consistency_score, attempted_count, not_attempted_count, completed_count, completion_rate, total_time_seconds, created_at)
           VALUES($1,$2,$3::date,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT (student_id, analytics_date) DO NOTHING`, [
                    studentId, orgId, dateStr,
                    Math.round(rand(salt + 13) * 14),
                    consistency,
                    dayAttempted,
                    Math.max(0, dayAttempted - dayCompleted),
                    dayCompleted,
                    completionRate,
                    dayTime,
                    date,
                ]);
                counts.analytics++;
            }
        }
        // ── Monthly real quiz attempts (drives academic trend) ──
        const months = YEARS_BACK * 12;
        for (let m = 0; m <= months; m++) {
            const date = new Date(start.getTime() + (m / months) * totalMs);
            if (date > today)
                break;
            const t = m / months;
            const salt = pi * 100 + m;
            const pct = scoreFor(p, t, salt + 7);
            if (quizRows.length > 0) {
                const quizId = pick(quizRows, m + pi).id;
                await db.query(`INSERT INTO student_attempts(student_id, quiz_id, score, total_points, completed_at)
           VALUES($1,$2,$3,100,$4)`, [studentId, quizId, pct, date]);
                counts.attempts++;
            }
        }
        // ── Classrooms + teacher remarks (drives teacher-feedback trend, 1-5) ──
        const TERMS = YEARS_BACK * 2; // two terms a year
        for (let i = 0; i <= TERMS; i++) {
            const created = new Date(start.getTime() + (i / TERMS) * totalMs);
            if (created > today)
                break;
            const t = i / TERMS;
            const salt = pi * 50 + i;
            const isActive = i === TERMS; // latest term still running
            const ended = isActive ? null : new Date(created.getTime() + 70 * 24 * 3600 * 1000);
            const teacherId = pick(teacherIds, pi + i);
            const status = isActive ? 'active' : 'completed';
            const classroom = await db.query(`INSERT INTO classrooms(organization_id, title, description, schedule_type, start_time, end_time, duration_minutes, class_level, created_by, status, is_global, created_at, updated_at, ended_at)
         VALUES($1,$2,$3,'instant',NULL,NULL,45,$4,$5,$6,false,$7,$7,$8) RETURNING id`, [orgId, `${p.subject} - Term ${i + 1}`, `${p.subject} classroom for Class ${p.classLevel}`, p.classLevel, teacherId, status, created, ended]);
            const classroomId = classroom.rows[0].id;
            counts.classrooms++;
            const pct = scoreFor(p, t, salt + 12);
            const remarkPool = pct >= 75 ? POSITIVE_REMARKS : pct >= 55 ? NEUTRAL_REMARKS : NEEDS_WORK_REMARKS;
            const remarkDate = ended ?? created;
            await db.query(`INSERT INTO classroom_student_remarks(classroom_id, student_id, teacher_id, remark_text, parent_note, remark_media_url, score_behavior, score_confidence, score_participation, score_performance, created_at, updated_at)
         VALUES($1,$2,$3,$4,$5,NULL,$6,$7,$8,$9,$10,$10)`, [
                classroomId, studentId, teacherId,
                pick(remarkPool, i),
                pct >= 75 ? 'Keep up the great work at home!' : 'A little daily practice will help a lot.',
                pctTo5(scoreFor(p, t, salt + 13)),
                pctTo5(scoreFor(p, t, salt + 14)),
                pctTo5(scoreFor(p, t, salt + 15)),
                pctTo5(pct),
                remarkDate,
            ]);
            counts.remarks++;
            // grant an achievement on strong terms
            if (achievements.length > 0 && pct >= 72 && !isActive) {
                const achId = pick(achievements, pi + i).id;
                try {
                    await db.query(`INSERT INTO student_achievements(student_id, classroom_id, achievement_id, granted_by, granted_at)
             VALUES($1,$2,$3,$4,$5)
             ON CONFLICT (student_id, classroom_id, achievement_id) DO NOTHING`, [studentId, classroomId, achId, teacherId, remarkDate]);
                    counts.achievements++;
                }
                catch {
                    // ignore grant failures (schema variance)
                }
            }
        }
        // ── Counseling sessions + reports (drives counseling-impact trend) ──
        const SESSIONS = YEARS_BACK + 1;
        for (let s = 0; s < SESSIONS; s++) {
            const when = new Date(start.getTime() + ((s + 0.5) / SESSIONS) * totalMs);
            if (when > today)
                break;
            const t = (s + 0.5) / SESSIONS;
            const salt = pi * 20 + s;
            const overall = scoreFor(p, t, salt + 16);
            const level = overall >= 80 ? 'Advanced' : overall >= 60 ? 'Intermediate' : 'Beginner';
            const submitted = new Date(when.getTime() + 25 * 60 * 1000);
            const snapshot = JSON.stringify({ name: `${p.studentFirst} ${p.studentLast}`, classLevel: p.classLevel, subject: p.subject });
            const reportJson = JSON.stringify({
                overall,
                subscores: {
                    academic: scoreFor(p, t, salt + 17),
                    cognitive: scoreFor(p, t, salt + 18),
                    behavior: scoreFor(p, t, salt + 19),
                    emotional: scoreFor(p, t, salt + 20),
                },
            });
            const session = await db.query(`INSERT INTO counseling_sessions(parent_user_id, student_user_id, organization_id, status, student_snapshot, duration_sec, started_at, submitted_at, created_at, updated_at)
         VALUES($1,$2,$3,'reported',$4::jsonb,$5,$6,$7,$6,$7) RETURNING id`, [parentId, studentId, orgId, snapshot, 1500, when, submitted]);
            const sessionId = session.rows[0].id;
            await db.query(`INSERT INTO counseling_reports(session_id, student_user_id, organization_id, overall_score, level, growth_potential, study_pattern_type, report_json, created_at)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)`, [
                sessionId, studentId, orgId, overall, level,
                overall >= 75 ? 'High' : overall >= 55 ? 'Medium' : 'Developing',
                p.noise > 12 ? 'Irregular' : p.slope > 25 ? 'Burst' : 'Consistent',
                reportJson, submitted,
            ]);
            counts.counseling++;
        }
        // ── Parent feedback (drives parent-sentiment trend) — quarterly ──
        const FEEDBACK = YEARS_BACK * 4;
        for (let f = 0; f <= FEEDBACK; f++) {
            const when = new Date(start.getTime() + (f / FEEDBACK) * totalMs);
            if (when > today)
                break;
            const t = f / FEEDBACK;
            const salt = pi * 30 + f;
            const pct = scoreFor(p, t, salt + 21);
            const pool = pct >= 72 ? POSITIVE_FEEDBACK : pct >= 52 ? NEUTRAL_FEEDBACK : NEEDS_WORK_FEEDBACK;
            await db.query(`INSERT INTO parent_feedback(parent_user_id, student_user_id, organization_id, feedback_text, attachment_url, created_at)
         VALUES($1,$2,$3,$4,NULL,$5)`, [parentId, studentId, orgId, pick(pool, f), when]);
            counts.feedback++;
        }
        // ── Parent assessments (0-10 ratings trend) — per term ──
        for (let a = 0; a <= TERMS; a++) {
            const when = new Date(start.getTime() + (a / TERMS) * totalMs);
            if (when > today)
                break;
            const t = a / TERMS;
            const salt = pi * 40 + a;
            const to10 = (sl) => clamp(Math.round(scoreFor(p, t, sl) / 10), 0, 10);
            await db.query(`INSERT INTO parent_assessments(parent_user_id, student_user_id, organization_id, behavior_score, focus_score, regularity_score, creativity_score, academic_score, outdoor_activity_score, created_at, updated_at)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)`, [
                parentId, studentId, orgId,
                to10(salt + 22), to10(salt + 23), to10(salt + 24),
                to10(salt + 25), to10(salt + 26), to10(salt + 27),
                when,
            ]);
            counts.assessments++;
        }
        console.log(`[demo-trends] ${p.studentFirst} ${p.studentLast} (Class ${p.classLevel}) seeded.`);
    }
    console.log('[demo-trends] Done. Inserted:', counts);
    console.log('[demo-trends] Login with any demo account, password:', PASSWORD);
    console.log(`[demo-trends] ⭐ Shared parent (sees ALL students): ${SHARED_PARENT.email}`);
    console.log('[demo-trends] Per-student parents:', PROFILES.map((p) => p.parentEmail).join(', '));
    console.log('[demo-trends] Students:', PROFILES.map((p) => p.studentEmail).join(', '));
    console.log('[demo-trends] Teachers:', TEACHERS.map((t) => t.email).join(', '));
}
//# sourceMappingURL=seed-demo-trends.js.map