import { eventBus } from './bus.js';
import { db } from '../db.js';
import { NotificationStore, type CreateNotificationInput } from '../services/notification-store.js';
import { Targeting } from '../services/targeting.js';

type ClassroomScheduledPayload = {
  classroomId: string;
  title: string;
  scheduleType: 'instant' | 'scheduled';
  startTime?: string | null;
  classLevel?: string | null;
  isRestart?: boolean;
};

type ClassroomEndedPayload = {
  classroomId: string;
  title?: string;
  quizzes?: Array<{ id: string; title: string }>;
  assignments?: Array<{ id: string; title: string }>;
};

type RemarkCreatedPayload = {
  remarkId?: string;
  classroomId?: string;
  studentUserId: string;
  teacherUserId?: string;
  message: string;
};

type BillingInvoicePayload = {
  invoiceId?: string;
  amount?: number;
  currency?: string;
  dueAt?: string;
  recipientUserIds?: string[];
};

function classroomRoute(_classroomId: string, _isScheduled: boolean) {
  return '/(tabs)/classroom';
}

async function loadUserName(userId: string): Promise<string | null> {
  try {
    const result = await db.query<{ first_name: string | null; last_name: string | null }>(
      `SELECT first_name, last_name FROM users WHERE id = $1::uuid LIMIT 1`,
      [userId],
    );
    const row = result.rows[0];
    if (!row) return null;
    return [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || null;
  } catch {
    return null;
  }
}

async function scheduleClassroomReminders(args: {
  classroomId: string;
  organizationId: string;
  title: string;
  startAt: Date;
}) {
  const rows = [
    {
      trigger: 'CLASS_REMINDER_1H',
      fireAt: new Date(args.startAt.getTime() - 60 * 60 * 1000),
    },
    {
      trigger: 'CLASS_REMINDER_10M',
      fireAt: new Date(args.startAt.getTime() - 10 * 60 * 1000),
    },
  ];
  for (const row of rows) {
    if (row.fireAt.getTime() < Date.now()) continue;
    await db.query(
      `INSERT INTO notification_schedules
         (classroom_id, organization_id, trigger_type, fire_at, payload)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5::jsonb)`,
      [
        args.classroomId,
        args.organizationId,
        row.trigger,
        row.fireAt.toISOString(),
        JSON.stringify({ title: args.title, startAt: args.startAt.toISOString() }),
      ],
    );
  }
}

export async function registerNotificationHandlers() {
  await eventBus.subscribe<ClassroomScheduledPayload>('classroom.scheduled', async (event) => {
    const orgId = event.organizationId;
    if (!orgId) {
      console.warn('[notification-service] classroom.scheduled missing organizationId, skipping');
      return;
    }
    const payload = event.payload;
    const { studentIds, parentByStudent } = await Targeting.resolveClassroom(payload.classroomId, orgId);
    const isInstant = payload.scheduleType === 'instant';
    const isRestart = !!payload.isRestart;
    const route = classroomRoute(payload.classroomId, !isInstant);
    const ctaLabel = isInstant ? 'Join Class' : 'View Class';
    const type = isRestart ? 'CLASS_RESTARTED' : isInstant ? 'CLASS_LIVE' : 'CLASS_SCHEDULED';

    const studentTitle = isRestart
      ? 'Class restarted — join now'
      : isInstant
        ? 'Your class is live'
        : `New class scheduled: ${payload.title}`;
    const studentMessage = isRestart
      ? `${payload.title} has been restarted by your teacher. Tap Join to rejoin.`
      : isInstant
        ? `${payload.title} is starting now. Tap to join.`
        : 'A new class has been scheduled for you.';

    const inputs: CreateNotificationInput[] = [];
    for (const studentId of studentIds) {
      inputs.push({
        userId: studentId,
        organizationId: orgId,
        type,
        category: 'classroom',
        title: studentTitle,
        message: studentMessage,
        ctaLabel,
        ctaRoute: route,
        metadata: { classroomId: payload.classroomId, startTime: payload.startTime ?? null, isRestart },
        sourceEventId: event.id,
      });
      const parentIds = parentByStudent[studentId] || [];
      const parentTitle = isRestart
        ? "Your child's class has restarted"
        : isInstant
          ? "Your child's class is live"
          : 'Class scheduled for your child';
      const parentMessage = isRestart
        ? `${payload.title} has been restarted by the teacher.`
        : `${payload.title}${payload.startTime ? ` at ${new Date(payload.startTime).toLocaleString()}` : ''}.`;
      for (const parentId of parentIds) {
        inputs.push({
          userId: parentId,
          organizationId: orgId,
          type,
          category: 'classroom',
          title: parentTitle,
          message: parentMessage,
          metadata: { classroomId: payload.classroomId, studentUserId: studentId, isRestart, audience: 'parent' },
          sourceEventId: event.id,
        });
      }
    }
    await NotificationStore.createMany(inputs);

    if (!isInstant && payload.startTime) {
      const startAt = new Date(payload.startTime);
      if (!Number.isNaN(startAt.getTime())) {
        await scheduleClassroomReminders({
          classroomId: payload.classroomId,
          organizationId: orgId,
          title: payload.title,
          startAt,
        });
      }
    }
  });

  await eventBus.subscribe<ClassroomEndedPayload>('classroom.ended', async (event) => {
    const orgId = event.organizationId;
    if (!orgId) return;

    await db.query(
      `UPDATE notification_schedules SET status = 'cancelled'
         WHERE classroom_id = $1::uuid AND status = 'pending'`,
      [event.payload.classroomId],
    );

    await NotificationStore.expireClassroomCtas(event.payload.classroomId, 'ended');

    const classroomId = event.payload.classroomId;
    const title = event.payload.title || 'class';
    const quizzes = event.payload.quizzes || [];
    const assignments = event.payload.assignments || [];

    const { studentIds, parentByStudent } = await Targeting.resolveClassroom(classroomId, orgId);
    if (studentIds.length === 0) return;

    const route = '/(tabs)/classroom';

    let attempts = new Map<string, Set<string>>();
    if (quizzes.length > 0) {
      const quizIds = quizzes.map((q) => q.id);
      const attemptsResult = await db.query<{ student_id: string; quiz_id: string }>(
        `SELECT DISTINCT student_id, quiz_id
           FROM student_attempts
          WHERE student_id = ANY($1::uuid[])
            AND quiz_id = ANY($2::uuid[])`,
        [studentIds, quizIds],
      );
      for (const row of attemptsResult.rows) {
        const set = attempts.get(row.student_id) ?? new Set<string>();
        set.add(row.quiz_id);
        attempts.set(row.student_id, set);
      }
    }

    let submissions = new Map<string, Set<string>>();
    if (assignments.length > 0) {
      const assignmentIds = assignments.map((a) => a.id);
      const submissionsResult = await db.query<{ student_id: string; classroom_assignment_id: string }>(
        `SELECT DISTINCT student_id, classroom_assignment_id
           FROM classroom_assignment_submissions
          WHERE student_id = ANY($1::uuid[])
            AND classroom_assignment_id = ANY($2::uuid[])`,
        [studentIds, assignmentIds],
      );
      for (const row of submissionsResult.rows) {
        const set = submissions.get(row.student_id) ?? new Set<string>();
        set.add(row.classroom_assignment_id);
        submissions.set(row.student_id, set);
      }
    }

    const inputs: CreateNotificationInput[] = [];
    for (const studentId of studentIds) {
      const pendingQuizzes = quizzes.filter((q) => !(attempts.get(studentId)?.has(q.id)));
      const pendingAssignments = assignments.filter((a) => !(submissions.get(studentId)?.has(a.id)));
      const pendingTotal = pendingQuizzes.length + pendingAssignments.length;

      const parts: string[] = [];
      if (pendingTotal === 0) {
        parts.push(`Great job — everything in "${title}" has been submitted.`);
      } else {
        const segments: string[] = [];
        if (pendingQuizzes.length > 0) segments.push(`${pendingQuizzes.length} quiz${pendingQuizzes.length > 1 ? 'zes' : ''}`);
        if (pendingAssignments.length > 0) segments.push(`${pendingAssignments.length} assignment${pendingAssignments.length > 1 ? 's' : ''}`);
        parts.push(`Class "${title}" has ended.`);
        parts.push(`Please finish and submit ${segments.join(' and ')} before the deadline.`);
      }

      inputs.push({
        userId: studentId,
        organizationId: orgId,
        type: pendingTotal > 0 ? 'CLASS_ENDED_PENDING' : 'CLASS_ENDED',
        category: 'classroom',
        title: pendingTotal > 0 ? `Class ended — finish your work` : `Class ended`,
        message: parts.join(' '),
        ctaLabel: pendingTotal > 0 ? 'Submit Now' : 'View Class',
        ctaRoute: route,
        metadata: {
          classroomId,
          pendingQuizzes: pendingQuizzes.map((q) => ({ id: q.id, title: q.title })),
          pendingAssignments: pendingAssignments.map((a) => ({ id: a.id, title: a.title })),
        },
        sourceEventId: event.id,
      });

      const parentIds = parentByStudent[studentId] || [];
      const parentMessage = pendingTotal === 0
        ? `Your child has completed all work for "${title}".`
        : `Your child has ${pendingQuizzes.length} pending quiz${pendingQuizzes.length === 1 ? '' : 'zes'} and ${pendingAssignments.length} pending assignment${pendingAssignments.length === 1 ? '' : 's'} for "${title}".`;
      for (const parentId of parentIds) {
        inputs.push({
          userId: parentId,
          organizationId: orgId,
          type: pendingTotal > 0 ? 'CLASS_ENDED_PENDING' : 'CLASS_ENDED',
          category: 'classroom',
          title: pendingTotal > 0 ? `Your child has pending work` : `Class ended`,
          message: parentMessage,
          metadata: {
            classroomId,
            studentUserId: studentId,
            pendingQuizzes: pendingQuizzes.length,
            pendingAssignments: pendingAssignments.length,
            audience: 'parent',
          },
          sourceEventId: event.id,
        });
      }
    }

    await NotificationStore.createMany(inputs);
  });

  await eventBus.subscribe<{ classroomId: string }>('classroom.deleted', async (event) => {
    if (!event.organizationId) return;
    await db.query(
      `UPDATE notification_schedules SET status = 'cancelled'
         WHERE classroom_id = $1::uuid AND status = 'pending'`,
      [event.payload.classroomId],
    );
    await NotificationStore.expireClassroomCtas(event.payload.classroomId, 'deleted');
  });

  await eventBus.subscribe<RemarkCreatedPayload>('notification.requested', async (event) => {
    if (event.payload && (event.payload as any).kind === 'student_remark') {
      const orgId = event.organizationId;
      if (!orgId) return;
      const data = event.payload as unknown as RemarkCreatedPayload;
      const { studentId, parentIds } = await Targeting.resolveStudentAndParents(data.studentUserId);

      const studentNotif = await NotificationStore.create({
        userId: studentId,
        organizationId: orgId,
        type: 'REMARK_RECEIVED',
        category: 'remark',
        title: 'New remark from teacher',
        message: data.message?.slice(0, 200) || 'Your teacher left a remark.',
        ctaLabel: 'View Details',
        ctaRoute: '/(tabs)/reports',
        metadata: { remarkId: data.remarkId, classroomId: data.classroomId },
        sourceEventId: event.id,
      });

      for (const parentId of parentIds) {
        await NotificationStore.create({
          userId: parentId,
          organizationId: orgId,
          type: 'REMARK_RECEIVED',
          category: 'remark',
          title: "Teacher remark for your child",
          message: data.message?.slice(0, 200) || 'A teacher left a remark.',
          ctaLabel: 'View Details',
          ctaRoute: '/(tabs)/reports',
          metadata: { remarkId: data.remarkId, classroomId: data.classroomId, studentUserId: studentId },
          sourceEventId: event.id,
          parentNotificationId: studentNotif?.id,
        });
      }
    }
  });

  const PARENT_AGG_WINDOW_MIN = 15;
  const TEACHER_AGG_WINDOW_MIN = 60;

  await eventBus.subscribe<{
    classroomId: string;
    classroomTitle?: string;
    teacherId?: string;
    assignmentId: string;
    assignmentTitle?: string;
    studentUserId: string;
  }>('assignment.submitted', async (event) => {
    const orgId = event.organizationId;
    if (!orgId) return;
    const data = event.payload;
    const { parentIds } = await Targeting.resolveStudentAndParents(data.studentUserId);
    const studentName = await loadUserName(data.studentUserId);
    const classroomTitle = data.classroomTitle || 'class';
    const route = '/(tabs)/classroom';

    for (const parentId of parentIds) {
      await NotificationStore.aggregateActivity({
        userId: parentId,
        organizationId: orgId,
        audienceType: 'CHILD_ACTIVITY',
        classroomId: data.classroomId,
        classroomTitle,
        activityKind: 'assignment_submitted',
        studentUserId: data.studentUserId,
        studentName,
        windowMinutes: PARENT_AGG_WINDOW_MIN,
        ctaLabel: null,
        ctaRoute: null,
        sourceEventId: event.id,
      });
    }
    if (data.teacherId) {
      await NotificationStore.aggregateActivity({
        userId: data.teacherId,
        organizationId: orgId,
        audienceType: 'STUDENT_ACTIVITY',
        classroomId: data.classroomId,
        classroomTitle,
        activityKind: 'assignment_submitted',
        studentUserId: data.studentUserId,
        studentName,
        windowMinutes: TEACHER_AGG_WINDOW_MIN,
        ctaLabel: 'Open Class',
        ctaRoute: route,
        sourceEventId: event.id,
      });
    }
  });

  await eventBus.subscribe<{
    quizId: string;
    quizTitle?: string;
    score: number;
    totalPoints: number;
    scorePercent: number;
    studentUserId: string;
    classroomId?: string | null;
    classroomTitle?: string | null;
    teacherId?: string | null;
  }>('quiz.submitted', async (event) => {

    const orgId = event.organizationId;
    if (!orgId) return;
    const data = event.payload;
    if (!data.classroomId) return;
    const { parentIds } = await Targeting.resolveStudentAndParents(data.studentUserId);
    const studentName = await loadUserName(data.studentUserId);
    const classroomTitle = data.classroomTitle || 'class';
    const route = '/(tabs)/classroom';

    for (const parentId of parentIds) {
      await NotificationStore.aggregateActivity({
        userId: parentId,
        organizationId: orgId,
        audienceType: 'CHILD_ACTIVITY',
        classroomId: data.classroomId,
        classroomTitle,
        activityKind: 'quiz_submitted',
        studentUserId: data.studentUserId,
        studentName,
        windowMinutes: PARENT_AGG_WINDOW_MIN,
        ctaLabel: null,
        ctaRoute: null,
        sourceEventId: event.id,
      });
    }
    if (data.teacherId) {
      await NotificationStore.aggregateActivity({
        userId: data.teacherId,
        organizationId: orgId,
        audienceType: 'STUDENT_ACTIVITY',
        classroomId: data.classroomId,
        classroomTitle,
        activityKind: 'quiz_submitted',
        studentUserId: data.studentUserId,
        studentName,
        windowMinutes: TEACHER_AGG_WINDOW_MIN,
        ctaLabel: 'Open Class',
        ctaRoute: route,
        sourceEventId: event.id,
      });
    }
  });

  await eventBus.subscribe<BillingInvoicePayload>(['billing.invoice.issued', 'billing.invoice.paid'], async (event) => {
    const orgId = event.organizationId;
    if (!orgId) return;
    const recipients = event.payload?.recipientUserIds || [];
    if (recipients.length === 0) return;
    const isIssued = event.type === 'billing.invoice.issued';
    const inputs: CreateNotificationInput[] = recipients.map((userId) => ({
      userId,
      organizationId: orgId,
      type: isIssued ? 'INVOICE_ISSUED' : 'INVOICE_PAID',
      category: 'billing',
      title: isIssued ? 'New invoice issued' : 'Invoice paid',
      message: isIssued
        ? 'A new invoice is awaiting payment for your organization.'
        : 'Your payment has been recorded.',
      ctaLabel: isIssued ? 'View Invoice' : 'View Receipt',
      ctaRoute: '/billing',
      metadata: event.payload as Record<string, unknown>,
      sourceEventId: event.id,
    }));
    await NotificationStore.createMany(inputs);
  });
}
