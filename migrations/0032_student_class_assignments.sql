  CREATE TABLE IF NOT EXISTS student_class_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    class_level VARCHAR(50) NOT NULL,
    is_all_classes BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(student_user_id, organization_id, class_level)
  );

-- Grant CRUD to the RLS-bound app role and the background-job admin role.
GRANT SELECT, INSERT, UPDATE, DELETE ON student_class_assignments TO els_app;
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER ON student_class_assignments TO els_admin;
