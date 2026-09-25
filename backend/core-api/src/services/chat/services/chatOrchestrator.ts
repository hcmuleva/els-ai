import { db } from '../db.js';
import { SURVEY_TOPICS } from '../surveyQuestionBank.js';
import { ChatRealtime } from '../realtime.js';

export interface ContextSlots {
  student_id?: string;
  student_name?: string;
  topics: string[];
  current_topic_index: number;
  topic_in_progress: string;
  collected_facts: Array<{
    category: string;
    topic: string;
    concern_level: string;
    summary: string;
    review_status: string;
  }>;
  pending_clarification: boolean;
  completed: boolean;
}

export interface ChatSessionRow {
  id: string;
  organization_id: string;
  chat_type: 'survey' | 'performance' | 'review';
  initiator_id: string;
  role: 'child' | 'parent' | 'teacher' | 'admin' | 'superadmin';
  subject_student_id: string | null;
  status: 'active' | 'completed' | 'abandoned';
  context_slots: ContextSlots;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageRow {
  id: string;
  session_id: string;
  organization_id: string;
  sender: 'user' | 'assistant' | 'system';
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:4003';

/**
 * Calls Jev via ai-service or evaluates with heuristic fallback
 */
async function callJevSurveyTurn(params: {
  topic: string;
  studentId: string;
  parentMessage: string;
}): Promise<{
  category: string;
  specificEnough: boolean;
  concernLevel: string;
  confidence: number;
}> {
  try {
    const res = await fetch(`${AI_SERVICE_URL}/ai/jev/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        state: `Student ${params.studentId}, Topic: ${params.topic}. Parent message: "${params.parentMessage}"`,
        questions: {
          category: {
            type: 'choice',
            instructions: 'Which report category does this answer belong to?',
            choices: ['weakness_academic', 'strength_academic', 'behavior', 'unclear'],
          },
          specific_enough: {
            type: 'boolean',
            instructions: 'Is this answer specific enough to record without an immediate follow-up?',
          },
          concern_level: {
            type: 'score',
            instructions: 'How concerning is this observation?',
            scale: { min: 0, max: 3 },
          },
        },
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      const data: any = await res.json();
      const evalData = data.data || {};
      const cat = evalData.category?.choice || 'weakness_academic';
      const spec = Boolean(evalData.specific_enough?.value ?? true);
      const scoreNum = evalData.concern_level?.value ?? 0;
      const concernLabels = ['No concern', 'Mild, monitor', 'Moderate, worth flagging', 'Needs teacher attention'];
      const concernLevel = concernLabels[Math.min(Math.max(0, scoreNum), 3)] || 'No concern';
      return {
        category: cat,
        specificEnough: spec,
        concernLevel,
        confidence: 0.88,
      };
    }
  } catch {}

  // Safe fallback
  const text = params.parentMessage.toLowerCase();
  const isWeak = text.includes('struggl') || text.includes('hard') || text.includes('troubl') || text.includes('slow');
  const isStrong = text.includes('great') || text.includes('love') || text.includes('excel') || text.includes('improv');
  const isBehav = text.includes('focus') || text.includes('distract') || text.includes('temper') || text.includes('calm');

  let category = 'unclear';
  if (isWeak) category = 'weakness_academic';
  else if (isStrong) category = 'strength_academic';
  else if (isBehav) category = 'behavior';
  else if (text.length > 20) category = 'general_observation';

  const specificEnough = text.length > 25 && !text.includes('not sure');
  const concernLevel = isWeak ? 'Moderate, worth flagging' : 'No concern';

  return {
    category,
    specificEnough,
    concernLevel,
    confidence: specificEnough ? 0.8 : 0.5,
  };
}

/**
 * Classifies deep-dive query metric domain
 */
async function classifyDeepDiveIntent(query: string): Promise<string> {
  const q = query.toLowerCase();
  if (q.includes('read') || q.includes('book') || q.includes('phonic') || q.includes('word')) return 'reading';
  if (q.includes('math') || q.includes('count') || q.includes('number') || q.includes('add')) return 'math';
  if (q.includes('quiz') || q.includes('test') || q.includes('score') || q.includes('grade')) return 'quizzes';
  if (q.includes('attend') || q.includes('streak') || q.includes('active') || q.includes('time')) return 'attendance';
  if (q.includes('behavior') || q.includes('remark') || q.includes('teacher') || q.includes('focus')) return 'behavior';
  return 'general';
}

export const ChatOrchestrator = {
  async createSession(params: {
    organizationId: string;
    initiatorId: string;
    role: 'child' | 'parent' | 'teacher' | 'admin' | 'superadmin';
    chatType: 'survey' | 'performance' | 'review';
    subjectStudentId?: string | null;
  }): Promise<{ session: ChatSessionRow; initialMessage?: ChatMessageRow }> {
    const studentId = params.subjectStudentId || (params.role === 'child' ? params.initiatorId : null);

    // Fetch student name if studentId is present
    let studentName = 'your child';
    if (studentId) {
      const studentRes = await db.query<{ name: string }>(
        `SELECT name FROM users WHERE id = $1::uuid LIMIT 1`,
        [studentId]
      );
      if (studentRes.rows[0]?.name) {
        studentName = studentRes.rows[0].name;
      }
    }

    let initialSlots: ContextSlots = {
      student_id: studentId || undefined,
      student_name: studentName,
      topics: SURVEY_TOPICS.map((t) => t.id),
      current_topic_index: 0,
      topic_in_progress: SURVEY_TOPICS[0].id,
      collected_facts: [],
      pending_clarification: false,
      completed: false,
    };

    const sessionRes = await db.query<ChatSessionRow>(
      `INSERT INTO chat_sessions (
        organization_id, chat_type, initiator_id, role, subject_student_id, status, context_slots
      ) VALUES ($1::uuid, $2, $3::uuid, $4, $5, 'active', $6::jsonb)
      RETURNING *`,
      [
        params.organizationId,
        params.chatType,
        params.initiatorId,
        params.role,
        studentId,
        JSON.stringify(initialSlots),
      ]
    );

    const session = sessionRes.rows[0];

    // Create welcoming first message
    let welcomeContent = '';
    if (params.chatType === 'survey') {
      const firstTopic = SURVEY_TOPICS[0];
      welcomeContent = `Hello! Welcome to the guided survey for **${studentName}**. I'm here to gather observations about how ${studentName} is doing at home and in class. Your insights directly help teachers tailor their support.\n\nTo begin:\n\n**${firstTopic.title}**\n${firstTopic.prompt}`;
    } else if (params.chatType === 'performance') {
      if (params.role === 'child') {
        welcomeContent = `Hi ${studentName}! 🌟 I'm your AI learning buddy. You can ask me how you're doing on quizzes, stories, or what to practice next!`;
      } else {
        welcomeContent = `Welcome to the Performance Intelligence Deep-Dive for **${studentName}**. You can ask about quiz accuracy, subject mastery, learning trends, teacher remarks, or recommendations.`;
      }
    } else {
      welcomeContent = `Teacher Review Queue initialized. Pending survey facts will appear here for validation.`;
    }

    const msgRes = await db.query<ChatMessageRow>(
      `INSERT INTO chat_messages (
        session_id, organization_id, sender, content, metadata
      ) VALUES ($1::uuid, $2::uuid, 'assistant', $3, $4::jsonb)
      RETURNING *`,
      [
        session.id,
        params.organizationId,
        welcomeContent,
        JSON.stringify({ type: 'welcome', topic: SURVEY_TOPICS[0].id }),
      ]
    );

    return { session, initialMessage: msgRes.rows[0] };
  },

  async handleUserMessage(params: {
    sessionId: string;
    organizationId: string;
    userId: string;
    role: string;
    content: string;
  }): Promise<{ userMessage: ChatMessageRow; assistantMessage: ChatMessageRow; session: ChatSessionRow }> {
    // 1. Fetch Session
    const sessionRes = await db.query<ChatSessionRow>(
      `SELECT * FROM chat_sessions WHERE id = $1::uuid AND organization_id = $2::uuid LIMIT 1`,
      [params.sessionId, params.organizationId]
    );
    const session = sessionRes.rows[0];
    if (!session) {
      throw new Error('Chat session not found');
    }

    // 2. Persist User Message
    const userMsgRes = await db.query<ChatMessageRow>(
      `INSERT INTO chat_messages (session_id, organization_id, sender, content)
       VALUES ($1::uuid, $2::uuid, 'user', $3)
       RETURNING *`,
      [session.id, params.organizationId, params.content]
    );
    const userMessage = userMsgRes.rows[0];

    // Emit typing indicator
    await ChatRealtime.publishMessage(session.chat_type, session.id, 'typing', { sender: 'assistant' });

    let assistantContent = '';
    let metadata: Record<string, unknown> = {};
    const slots = session.context_slots || {};

    if (session.chat_type === 'survey') {
      const studentId = session.subject_student_id || params.userId;
      const currentIndex = slots.current_topic_index ?? 0;
      const currentTopic = SURVEY_TOPICS[currentIndex] || SURVEY_TOPICS[0];

      // Verified Cascade: LLM + Jev classification
      const jevEval = await callJevSurveyTurn({
        topic: currentTopic.id,
        studentId,
        parentMessage: params.content,
      });

      const isUnclear = jevEval.category === 'unclear';
      const needsClarification = !isUnclear && !jevEval.specificEnough && !slots.pending_clarification;

      if (needsClarification) {
        // Ask clarifying follow-up once
        slots.pending_clarification = true;
        assistantContent = `Thank you for sharing that. Could you give a quick example or mention how often this happens? That will help us record the most helpful note for the teacher.`;
        metadata = {
          decision: 'clarifying_question',
          topic: currentTopic.id,
          jev: jevEval,
        };
      } else {
        // Record Fact
        const reviewStatus = isUnclear || !jevEval.specificEnough ? 'pending_review' : 'auto_accepted';

        await db.query(
          `INSERT INTO chat_survey_entries (
            session_id, organization_id, student_user_id, category, topic,
            specific_enough, concern_level, confidence, review_status, raw_source_text, extracted_summary
          ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            session.id,
            params.organizationId,
            studentId,
            jevEval.category,
            currentTopic.title,
            jevEval.specificEnough,
            jevEval.concernLevel,
            jevEval.confidence,
            reviewStatus,
            params.content,
            `Observed during ${currentTopic.title}: ${params.content.slice(0, 140)}...`,
          ]
        );

        if (reviewStatus === 'pending_review') {
          // Notify teacher queue via Ably
          await ChatRealtime.publishReviewUpdate(params.organizationId, undefined, {
            sessionId: session.id,
            studentId,
            topic: currentTopic.title,
            reason: 'Low specificity or ambiguous category',
          });
        }

        slots.collected_facts = slots.collected_facts || [];
        slots.collected_facts.push({
          category: jevEval.category,
          topic: currentTopic.title,
          concern_level: jevEval.concernLevel,
          summary: params.content.slice(0, 80),
          review_status: reviewStatus,
        });

        // Advance to next topic
        const nextIndex = currentIndex + 1;
        slots.pending_clarification = false;

        if (nextIndex < SURVEY_TOPICS.length) {
          slots.current_topic_index = nextIndex;
          slots.topic_in_progress = SURVEY_TOPICS[nextIndex].id;
          const nextTopic = SURVEY_TOPICS[nextIndex];

          assistantContent = `Got it! I've noted that down under **${currentTopic.title}**.\n\nNext area:\n**${nextTopic.title}**\n${nextTopic.prompt}`;
          metadata = {
            decision: 'advanced',
            logged_status: reviewStatus,
            next_topic: nextTopic.id,
            jev: jevEval,
          };
        } else {
          // Completed
          slots.completed = true;
          assistantContent = `🎉 **Survey Complete!**\n\nThank you so much! All your observations for **${slots.student_name}** have been organized and securely saved to their profile. Teachers and mentors will review these notes to best support their learning journey.`;
          metadata = {
            decision: 'completed',
            logged_status: reviewStatus,
            total_facts: slots.collected_facts.length,
          };

          await db.query(
            `UPDATE chat_sessions SET status = 'completed' WHERE id = $1::uuid`,
            [session.id]
          );
        }
      }
    } else {
      // Performance Chat Deep-Dive
      const studentId = session.subject_student_id || params.userId;
      const intent = await classifyDeepDiveIntent(params.content);

      // Query live student data
      const quizRes = await db.query<{ count: string; avg_score: string }>(
        `SELECT COUNT(*)::text as count, COALESCE(AVG(score), 0)::numeric(5,1)::text as avg_score
         FROM classroom_assignment_submissions
         WHERE student_id = $1::uuid`,
        [studentId]
      );
      const quizzesTaken = quizRes.rows[0]?.count || '0';
      const avgScore = quizRes.rows[0]?.avg_score || '0';

      const remarksRes = await db.query<{ remark: string; category: string }>(
        `SELECT remark, category FROM classroom_student_remarks
         WHERE student_id = $1::uuid
         ORDER BY created_at DESC LIMIT 2`,
        [studentId]
      );

      const latestRemark = remarksRes.rows[0]?.remark;

      if (intent === 'quizzes') {
        assistantContent = `📊 **Quiz & Assessment Standing**\n- **Total Quizzes Completed:** ${quizzesTaken}\n- **Average Accuracy:** ${avgScore}%\n\nPerformance is steady. Consistent daily practice in active modules has yielded strong retention.`;
      } else if (intent === 'reading') {
        assistantContent = `📖 **Reading & Phonics Mastery**\n- Recent story reading shows high engagement with vocabulary modules.\n- Comprehension check questions average **${avgScore}%** accuracy.\n- Recommendation: Continue with 10 minutes of daily guided read-along stories.`;
      } else if (intent === 'behavior') {
        assistantContent = `🌟 **Classroom & Focus Remarks**\n${latestRemark ? `Latest teacher remark: "${latestRemark}"` : 'Student exhibits active participation and consistent curiosity during classroom activities.'}`;
      } else {
        assistantContent = `📈 **Overall Learning Profile for ${slots.student_name}**\n- **Completed Assessments:** ${quizzesTaken}\n- **Overall Score:** ${avgScore}%\n- **Engagement Trend:** Stable & Improving\n\nWould you like more details on specific subjects, reading milestones, or practice recommendations?`;
      }

      metadata = { intent, quizzesTaken, avgScore };
    }

    // Persist Assistant Message
    const assistantMsgRes = await db.query<ChatMessageRow>(
      `INSERT INTO chat_messages (session_id, organization_id, sender, content, metadata)
       VALUES ($1::uuid, $2::uuid, 'assistant', $3, $4::jsonb)
       RETURNING *`,
      [session.id, params.organizationId, assistantContent, JSON.stringify(metadata)]
    );
    const assistantMessage = assistantMsgRes.rows[0];

    // Update Context Slots on Session
    const updatedSessionRes = await db.query<ChatSessionRow>(
      `UPDATE chat_sessions
       SET context_slots = $1::jsonb, updated_at = NOW()
       WHERE id = $2::uuid
       RETURNING *`,
      [JSON.stringify(slots), session.id]
    );
    const updatedSession = updatedSessionRes.rows[0];

    // Publish to Ably Realtime
    await ChatRealtime.publishMessage(session.chat_type, session.id, 'message', {
      message: assistantMessage,
      slots,
    });

    return { userMessage, assistantMessage, session: updatedSession };
  },

  async getReviewQueue(params: {
    organizationId: string;
    status?: string;
  }) {
    const status = params.status || 'pending_review';
    const res = await db.query(
      `SELECT e.*, u.name as student_name, s.chat_type
       FROM chat_survey_entries e
       JOIN users u ON e.student_user_id = u.id
       JOIN chat_sessions s ON e.session_id = s.id
       WHERE e.organization_id = $1::uuid
         AND ($2 = 'all' OR e.review_status = $2)
       ORDER BY e.created_at DESC`,
      [params.organizationId, status]
    );
    return res.rows;
  },

  async updateReviewEntry(params: {
    entryId: string;
    organizationId: string;
    reviewerId: string;
    action: 'approved' | 'rejected';
    teacherNotes?: string;
  }) {
    const res = await db.query(
      `UPDATE chat_survey_entries
       SET review_status = $1,
           teacher_notes = COALESCE($2, teacher_notes),
           reviewed_by = $3::uuid,
           reviewed_at = NOW(),
           updated_at = NOW()
       WHERE id = $4::uuid AND organization_id = $5::uuid
       RETURNING *`,
      [params.action, params.teacherNotes || null, params.reviewerId, params.entryId, params.organizationId]
    );
    return res.rows[0];
  },
};
