export type ClassroomTargets = {
    studentIds: string[];
    parentByStudent: Record<string, string[]>;
};
export declare const Targeting: {
    resolveClassroom(classroomId: string, organizationId: string): Promise<ClassroomTargets>;
    resolveStudentAndParents(studentUserId: string): Promise<{
        studentId: string;
        parentIds: string[];
    }>;
    resolveTeachersForStudent(studentUserId: string, organizationId: string): Promise<string[]>;
};
//# sourceMappingURL=targeting.d.ts.map