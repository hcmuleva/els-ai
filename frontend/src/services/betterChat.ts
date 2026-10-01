export type ChatType = 'survey' | 'performance' | 'review';

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

export interface ChatSession {
  id: string;
  organization_id: string;
  chat_type: ChatType;
  initiator_id: string;
  role: 'child' | 'parent' | 'teacher' | 'admin' | 'superadmin';
  subject_student_id: string | null;
  status: 'active' | 'completed' | 'abandoned';
  context_slots: ContextSlots;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  organization_id: string;
  sender: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface ReviewEntry {
  id: string;
  session_id: string;
  organization_id: string;
  student_user_id: string;
  student_name?: string;
  category: string;
  topic: string;
  specific_enough: boolean;
  concern_level: string;
  confidence: number;
  review_status: 'auto_accepted' | 'pending_review' | 'approved' | 'rejected';
  raw_source_text: string;
  extracted_summary?: string;
  teacher_notes?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
}

type ApiFetch = (path: string, options?: RequestInit) => Promise<Response>;

export async function createChatSession(
  apiFetch: ApiFetch,
  chatType: ChatType,
  subjectStudentId?: string | null
): Promise<{ session: ChatSession; initialMessage?: ChatMessage }> {
  const res = await apiFetch('/chat/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatType, subjectStudentId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to start chat session');
  }
  return res.json();
}

export async function fetchChatSession(
  apiFetch: ApiFetch,
  sessionId: string
): Promise<ChatSession> {
  const res = await apiFetch(`/chat/sessions/${sessionId}`);
  if (!res.ok) throw new Error('Failed to load chat session');
  const data = await res.json();
  return data.session;
}

export async function fetchChatMessages(
  apiFetch: ApiFetch,
  sessionId: string
): Promise<ChatMessage[]> {
  const res = await apiFetch(`/chat/sessions/${sessionId}/messages`);
  if (!res.ok) throw new Error('Failed to load chat messages');
  const data = await res.json();
  return data.messages || [];
}

export async function sendChatMessage(
  apiFetch: ApiFetch,
  sessionId: string,
  content: string
): Promise<{
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
  session: ChatSession;
}> {
  const res = await apiFetch(`/chat/sessions/${sessionId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to send message');
  }
  return res.json();
}

export async function fetchChatReviewQueue(
  apiFetch: ApiFetch,
  status: string = 'pending_review'
): Promise<ReviewEntry[]> {
  const res = await apiFetch(`/chat/review?status=${encodeURIComponent(status)}`);
  if (!res.ok) throw new Error('Failed to load review queue');
  const data = await res.json();
  return data.entries || [];
}

export async function updateReviewEntry(
  apiFetch: ApiFetch,
  entryId: string,
  action: 'approved' | 'rejected',
  teacherNotes?: string
): Promise<ReviewEntry> {
  const res = await apiFetch(`/chat/review/${entryId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, teacherNotes }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to update review entry');
  }
  const data = await res.json();
  return data.entry;
}

export async function fetchReviewStats(
  apiFetch: ApiFetch
): Promise<Record<string, number>> {
  const res = await apiFetch('/chat/review/stats');
  if (!res.ok) throw new Error('Failed to load review stats');
  const data = await res.json();
  return data.counts || {};
}
