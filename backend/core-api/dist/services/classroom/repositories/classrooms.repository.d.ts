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
export declare const classroomsRepository: {
    findById(classroomId: string, organizationId: string): Promise<ClassroomRow | null>;
    countActive(organizationId: string): Promise<number>;
    markEnded(classroomId: string, organizationId: string): Promise<any>;
};
//# sourceMappingURL=classrooms.repository.d.ts.map