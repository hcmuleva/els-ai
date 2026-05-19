Enhance the existing ELS‑AI system design with the following two critical requirements.
These requirements are mandatory and must be enforced across the entire system.

────────────────────────────────
1. MOBILE ROLE-BASED SEGREGATION (CRITICAL UX REQUIREMENT)
────────────────────────────────

The mobile application must provide clearly segregated UI/UX experiences
based on the ACTIVE PROFILE selected by the user.

Supported Profiles:
• Student
• Teacher
• Parent
• Admin

────────────────
1.1 PROFILE SWITCH BEHAVIOR
────────────────

• A single user can have multiple profiles
• Profile selector (dropdown near top-right) allows switching
• On profile switch:
   ✅ Entire app layout changes dynamically
   ✅ Navigation, permissions, and content are updated
   ✅ No app restart required

────────────────
1.2 ROLE-WISE SCREEN SEGREGATION
────────────────

Each role must have a DISTINCT UI experience:

────────────────
A) STUDENT VIEW
────────────────
Focus: Learning & Engagement

Screens:
• Home:
   - Learning content (stories, puzzles, Jr Scientist, etc.)
   - Assigned tasks
• Practice / Quiz:
   - Questions
   - Self-assessment
• Reports:
   - Score trends
   - Topic performance
• Recommendations:
   - Personalized AI suggestions

UI Style:
• Colorful, engaging, simple
• Content-first layout

────────────────
B) TEACHER VIEW
────────────────
Focus: Planning, evaluation, and content management

Screens:
• Classroom Planner
• Exam & Question Setup
• Student Assessment Dashboard
• Content Evaluation (AI vs Manual)
• Reports:
   - Class performance
   - Topic insights

UI Style:
• Data-rich
• Functional and structured

────────────────
C) PARENT VIEW
────────────────
Focus: Monitoring and guidance

Screens:
• Child Progress Dashboard
• Reports:
   - Academic
   - Behavioral
• Recommendations:
   - How to support child

UI Style:
• Simple, clear, insight-driven

────────────────
D) ADMIN VIEW
────────────────
Focus: System management

Screens:
• User Management
• Class / Subject / Course Setup
• Assignment Mapping
• Content control
• Reports overview

UI Style:
• Form-heavy
• Control-oriented

────────────────
1.3 NAVIGATION ADAPTATION
────────────────

Bottom Navigation MUST change per role:

Examples:

Student:
• Home | Practice | Reports

Teacher:
• Home | Planner | Reports | Content

Parent:
• Home | Reports

Admin:
• Home | Reports | Admin

RULE:
❌ No role should see irrelevant tabs
✅ Navigation must be context-aware

────────────────────────────────
2. ENVIRONMENT CONFIGURATION (MANDATORY – ZERO HARDCODING)
────────────────────────────────

All backend and mobile services MUST strictly use environment-based configuration.

────────────────
2.1 CONFIGURATION SOURCE
────────────────

• Use `.env` file for:
   - Database configuration
   - S3 credentials
   - API URLs
   - Service ports
   - Feature flags

Example:
DATABASE_URL=
S3_BUCKET=
API_BASE_URL=

────────────────
2.2 STRICT RULE
────────────────

❌ NO hardcoding allowed in:
   - Backend services
   - Mobile app code
   - API endpoints
   - Credentials
   - URLs

✅ ALL values must be read from environment variables

────────────────
2.3 ENVIRONMENT SUPPORT
────────────────

System must support:
• Local
• Dev
• Test
• UAT
• Production

Each environment must have:
• Separate `.env` file
• Separate configuration values

────────────────
2.4 IMPLEMENTATION GUIDELINES
────────────────

Backend (Node.js):
• Use process.env
• Use config loader (dotenv or equivalent)
• Validate required env variables on startup

Mobile (React Native):
• Use environment config library (react-native-config / expo env)
• No direct URL string usage

────────────────
2.5 SECURITY & BEST PRACTICES
────────────────

• Never commit secrets to repository
• Use `.env.example` for template
• Validate:
   - Missing variables
   - Invalid configurations

────────────────
2.6 FAILURE HANDLING
────────────────

If `.env` values are missing:

• System must:
   - Fail fast with clear error
   - Log missing configuration
   - Prevent partial startup

────────────────────────────────
FINAL GOAL (ENHANCED)
────────────────────────────────

The system must provide:

✅ Fully role-based personalized mobile experience  
✅ Clean separation of concerns per profile  
✅ Centralized configuration  
✅ Environment-independent deployment  
✅ Production-ready, secure architecture  

The system should feel like:
“A smart platform that adapts itself instantly based on who is using it.”