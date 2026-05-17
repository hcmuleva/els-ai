# ELS-AI Implementation Plan (Expo + Node + Postgres)

## Goal

Create a working monorepo with:
- Expo mobile app
- Node/Express backend
- Local PostgreSQL integration (`els_ai_db`)
- Multi-role users
- Role switcher from profile icon menu
- Role-based tab/screen layout
- `lucide-react-native` for icons

## Official Expo Installer Flow

Use Expo’s recommended starter command:

```bash
npx create-expo-app@latest apps/mobile
```

Then install required mobile packages:

```bash
cd apps/mobile
npx expo install expo-router react-native-safe-area-context react-native-screens react-native-gesture-handler react-native-reanimated
npm install lucide-react-native
```

## Monorepo Structure

```txt
els-ai/
├── package.json
├── apps/
│   ├── mobile/
│   │   ├── app/
│   │   │   ├── _layout.tsx
│   │   │   ├── (tabs)/
│   │   │   │   ├── _layout.tsx
│   │   │   │   ├── index.tsx
│   │   │   │   ├── practice.tsx
│   │   │   │   ├── planner.tsx
│   │   │   │   ├── reports.tsx
│   │   │   │   ├── content.tsx
│   │   │   │   ├── admin.tsx
│   │   │   │   └── settings.tsx
│   │   └── src/
│   │       ├── components/
│   │       │   ├── header/ProfileMenu.tsx
│   │       │   └── header/RoleSwitcher.tsx
│   │       ├── context/AuthContext.tsx
│   │       ├── config/roleTabs.ts
│   │       └── types/roles.ts
│   └── backend/
│       ├── package.json
│       └── src/
│           ├── server.ts
│           ├── db.ts
│           ├── seed.ts
│           ├── types.ts
│           └── routes/
│               └── users.ts
```

## Role Change UX (Profile Icon)

On profile icon click, open menu:
1. Profile
2. Settings
3. Divider
4. Roles section (all roles available for logged-in user)

Selecting a role updates active role in state and re-renders tabs/screens immediately.

## Role-Based Tabs

- Student: `Home`, `Practice`, `Reports`
- Teacher: `Home`, `Planner`, `Reports`, `Content`
- Parent: `Home`, `Reports`
- Admin: `Home`, `Reports`, `Admin`

Tabs are hidden/shown dynamically from `activeRole`.

## Backend + Postgres (Local)

Use local PostgreSQL connection with database:
- `DB_NAME=els_ai_db`

Tables:
- `users`
- `roles`
- `user_roles` (many-to-many)

API:
- `GET /health`
- `GET /users/:id` (returns profile + roles)
- `PATCH /users/:id/active-role` (sets current role if assigned)

Seed one sample user with multiple roles (e.g. `student`, `teacher`, `parent`).

## Environment

Backend `.env`:

```bash
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=els_ai_db
PORT=4000
```

Mobile `.env`:

```bash
EXPO_PUBLIC_API_BASE_URL=http://localhost:4000
```

## Icon Library

Use `lucide-react-native` across tab icons and profile menu actions.
