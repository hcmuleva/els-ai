export type UserRow = {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    password_hash: string;
    active_role: string;
    profile_image: string | null;
};
export declare const usersRepository: {
    findByEmail(email: string): Promise<UserRow | null>;
    findById(id: string): Promise<UserRow | null>;
    listRolesForUser(userId: string): Promise<Array<{
        roleName: string;
        organizationId: string;
    }>>;
};
//# sourceMappingURL=users.repository.d.ts.map