import { db } from '../db.js';
export const Targeting = {
    async resolveClassroom(classroomId, organizationId) {
        const studentRes = await db.query(`SELECT DISTINCT u.id AS user_id, u.class_level
         FROM classrooms c
         INNER JOIN user_roles ur ON ur.organization_id = c.organization_id
         INNER JOIN roles r ON r.id = ur.role_id
         INNER JOIN users u ON u.id = ur.user_id
        WHERE c.id = $1::uuid
          AND c.organization_id = $2::uuid
          AND u.deleted_at IS NULL
          AND u.is_active = true
          AND r.role_name = 'student'
          AND (c.class_level IS NULL OR c.class_level = u.class_level)`, [classroomId, organizationId]);
        const studentIds = studentRes.rows.map((row) => row.user_id);
        if (studentIds.length === 0)
            return { studentIds, parentByStudent: {} };
        const parentRes = await db.query(`SELECT parent_user_id, student_user_id
         FROM parent_student_links
        WHERE student_user_id = ANY($1::uuid[])`, [studentIds]);
        const parentByStudent = {};
        for (const row of parentRes.rows) {
            const arr = parentByStudent[row.student_user_id] ?? (parentByStudent[row.student_user_id] = []);
            arr.push(row.parent_user_id);
        }
        return { studentIds, parentByStudent };
    },
    async resolveStudentAndParents(studentUserId) {
        const result = await db.query(`SELECT parent_user_id FROM parent_student_links WHERE student_user_id = $1::uuid`, [studentUserId]);
        return { studentId: studentUserId, parentIds: result.rows.map((r) => r.parent_user_id) };
    },
};
