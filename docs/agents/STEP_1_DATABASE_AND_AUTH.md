# Step 1: Database & Authentication Implementation Guide

## 1. Database Schema (PostgreSQL)
All fields MUST use `snake_case`. All primary keys MUST use `uuid` (gen_random_uuid()).

### 1.1 Core User & Auth Tables
```sql
-- Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    mobile_number VARCHAR(20) UNIQUE,
    password_hash TEXT NOT NULL,
    gender VARCHAR(20),
    date_of_birth DATE,
    education TEXT,
    profile_image TEXT,
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    active_role VARCHAR(50),
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);

-- Roles Table
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_name VARCHAR(50) UNIQUE NOT NULL, -- 'superadmin', 'admin', 'teacher', 'parent', 'student'
    created_at TIMESTAMP DEFAULT NOW()
);

-- User Roles (Many-to-Many)
CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, role_id)
);

-- Refresh Tokens Table (Rotation & Security)
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    device_info TEXT,
    ip_address TEXT,
    expires_at TIMESTAMP NOT NULL,
    revoked BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 1.2 Multi-Tenancy (Organizations)
```sql
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(100) UNIQUE,
    logo_url TEXT,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Map users to Orgs with specific roles
ALTER TABLE user_roles ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
```

### 1.3 Permissions Baseline
```sql
CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    permission_key VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
    UNIQUE(role_id, permission_id)
);
```

## 2. Authentication Flow

### 2.1 Login
1. Validate email/password.
2. Generate **Access Token** (Short-lived: 15m).
3. Generate **Refresh Token** (Long-lived: 30d).
4. Hash Refresh Token and store in `refresh_tokens` table.
5. Return both tokens and user profile (including available roles/orgs).
6. Set/return `active_role` for immediate role-based UX.

### 2.2 Token Refresh
1. Client sends Refresh Token.
2. Server hashes it and checks against `refresh_tokens` (ensure not revoked and not expired).
3. If valid, issue NEW Access Token and NEW Refresh Token (Rotate).
4. Revoke the old Refresh Token.

### 2.3 RBAC Middleware
- Check `Authorization: Bearer <access_token>`.
- Decode JWT to get `user_id` and `organization_id`.
- Verify user has required role for the specific organization.
- Verify route permission against `role_permissions`.

## 3. Environment Rules
- Load auth configuration from env only (`PORT`, `JWT_*`, `DB_*`).
- Validate required env vars on startup.
- Fail fast when env values are missing/invalid.

## 4. Implementation Checklist for Agents
- [ ] Implement `POST /auth/register` with role selection.
- [ ] Implement `POST /auth/login` with JWT and Refresh Token logic.
- [ ] Implement `POST /auth/refresh` for token rotation.
- [ ] Implement `PATCH /users/:id/active-role` with DB persistence.
- [ ] Setup PostgreSQL migrations using an ORM (Prisma/Drizzle recommended).
- [ ] Ensure all user data uses `snake_case`.
- [ ] Setup secure token storage in client.
- [ ] Add startup env validation in auth-service.
