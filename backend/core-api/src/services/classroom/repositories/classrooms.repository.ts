import { db } from '../db.js';

export type ClassroomRow = {
  id: string;
  title: string;
  description: string | null;
  schedule_type: 'instant' | 'scheduled';
  start_time: string | Date | null;
  duration_minutes: number | null;
  class_level: string;
  status: string;
  is_global: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  organization_id: string;
};

export const classroomsRepository = {
  async findById(classroomId: string, organizationId: string): Promise<ClassroomRow | null> {
    const result = await db.query<ClassroomRow>(
      `SELECT id, title, description, schedule_type, start_time, duration_minutes,
              class_level, status, is_global, created_by, created_at, updated_at, organization_id
       FROM classrooms
       WHERE id = $1::uuid AND organization_id = $2::uuid
       LIMIT 1`,
      [classroomId, organizationId],
    );
    return result.rows[0] || null;
  },

  async countActive(organizationId: string): Promise<number> {
    const result = await db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM classrooms
       WHERE organization_id = $1::uuid AND status = 'active'`,
      [organizationId],
    );
    return Number(result.rows[0]?.count || 0);
  },

  async markEnded(classroomId: string, organizationId: string) {
    const result = await db.query(
      `UPDATE classrooms
       SET status = 'completed', ended_at = NOW(), updated_at = NOW()
       WHERE id = $1::uuid AND organization_id = $2::uuid
       RETURNING id, status, ended_at`,
      [classroomId, organizationId],
    );
    return result.rows[0] || null;
  },
};
