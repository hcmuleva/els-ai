/**
 * One-shot script to upsert the full subject catalog for every organization
 * in the database, for every class level (LKG, UKG, 1..12).
 *
 * It mirrors auth-service/src/seed/seed.ts's `upsertSubjectCatalogForOrganization`,
 * so running this is equivalent to re-running the subject seeder without
 * touching anything else.
 *
 * Usage:
 *   node scripts/seed_subjects_for_all_classes.cjs
 *
 * Optional environment overrides (else read from backend/auth-service/.env):
 *   DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
 *   ORG_ID                Limit upsert to a single organization
 *   DRY_RUN=1             Log changes but don't write
 */

const path = require('path');
const dotenv = require('dotenv');
const { Pool } = require('pg');

// Pick up DB credentials from the auth-service .env (same pool used at runtime).
dotenv.config({ path: path.resolve(__dirname, '../backend/auth-service/.env') });

const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
const ORG_ID_FILTER = (process.env.ORG_ID || '').trim();

const LKG_UKG_SUBJECTS = [
  { title: 'English', description: 'Foundational language skills for listening, speaking, and early literacy.', iconImage: 'symbol:book-open', iconBgColor: '#D6EAFF' },
  { title: 'Mathematics', description: 'Number sense, counting, and early problem-solving activities.', iconImage: 'symbol:hash', iconBgColor: '#FFE8D6', aliases: ['Maths'] },
  { title: 'Environmental Studies', description: 'Awareness of surroundings, nature, and everyday life concepts.', iconImage: 'symbol:leaf', iconBgColor: '#D6F5D6', aliases: ['EVS', 'Environmental Studies (EVS)'] },
  { title: 'Rhymes & Stories', description: 'Songs, rhymes, and storytelling to build language rhythm and imagination.', iconImage: 'symbol:sparkles', iconBgColor: '#EDE4FF', aliases: ['Hindi Stories'] },
  { title: 'Drawing & Coloring', description: 'Creative expression through drawing, coloring, and visual exploration.', iconImage: 'symbol:palette', iconBgColor: '#FFF5CC' },
  { title: 'Activity / Play-based Learning', description: 'Hands-on playful activities for social, motor, and cognitive growth.', iconImage: 'symbol:activity', iconBgColor: '#E0F2FE', aliases: ['Activity', 'Play-based Learning'] },
  { title: 'General Knowledge', description: 'General awareness about people, places, and the world.', iconImage: 'symbol:globe', iconBgColor: '#FFF5CC', aliases: ['GK'] },
  { title: 'Moral Values', description: 'Stories and discussions to introduce kindness, sharing, and good habits.', iconImage: 'symbol:sparkles', iconBgColor: '#FFE8D6', aliases: ['Values'] },
];

const PRIMARY_SUBJECTS = [
  { title: 'English', description: 'Reading, writing, vocabulary, and communication practice.', iconImage: 'symbol:book-open', iconBgColor: '#D6EAFF' },
  { title: 'Mathematics', description: 'Arithmetic, number operations, and logical reasoning.', iconImage: 'symbol:hash', iconBgColor: '#FFE8D6', aliases: ['Maths'] },
  { title: 'Environmental Studies (EVS)', description: 'Integrated learning of natural and social surroundings.', iconImage: 'symbol:leaf', iconBgColor: '#D6F5D6', aliases: ['EVS', 'Environmental Studies'] },
  { title: 'Hindi', description: 'Hindi language development in reading, writing, and speaking.', iconImage: 'symbol:languages', iconBgColor: '#EDE4FF' },
  { title: 'General Knowledge', description: 'General awareness about people, places, and the world.', iconImage: 'symbol:globe', iconBgColor: '#FFF5CC', aliases: ['GK'] },
  { title: 'Computer Science', description: 'Basic computer awareness, digital tools, and safe technology use.', iconImage: 'symbol:monitor', iconBgColor: '#E0F2FE', aliases: ['Computer'] },
  { title: 'Moral Values', description: 'Stories and discussions to introduce kindness, sharing, and good habits.', iconImage: 'symbol:sparkles', iconBgColor: '#FFE8D6', aliases: ['Values'] },
];

const MIDDLE_SUBJECTS = [
  { title: 'English', description: 'Comprehension, grammar, writing skills, and communication.', iconImage: 'symbol:book-open', iconBgColor: '#D6EAFF' },
  { title: 'Mathematics', description: 'Core math concepts including algebraic and numerical reasoning.', iconImage: 'symbol:hash', iconBgColor: '#FFE8D6', aliases: ['Maths'] },
  { title: 'Science', description: 'General science concepts with observation and experimentation.', iconImage: 'symbol:flask', iconBgColor: '#D6F5D6' },
  { title: 'Social Science', description: 'History, civics, geography, and societal understanding.', iconImage: 'symbol:globe', iconBgColor: '#FFF5CC', aliases: ['Social'] },
  { title: 'Hindi', description: 'Advanced Hindi language and literature fundamentals.', iconImage: 'symbol:languages', iconBgColor: '#EDE4FF' },
  { title: 'Sanskrit', description: 'Introductory Sanskrit language and grammar foundations.', iconImage: 'symbol:languages', iconBgColor: '#EDE4FF' },
  { title: 'Computer Science', description: 'Digital literacy, basic coding ideas, and computer applications.', iconImage: 'symbol:monitor', iconBgColor: '#E0F2FE', aliases: ['Computer'] },
];

const NINTH_TENTH_SUBJECTS = [
  { title: 'English', description: 'Language proficiency, literature appreciation, and writing skills.', iconImage: 'symbol:book-open', iconBgColor: '#D6EAFF' },
  { title: 'Mathematics', description: 'Algebra, geometry, mensuration, and problem-solving.', iconImage: 'symbol:hash', iconBgColor: '#FFE8D6', aliases: ['Maths'] },
  { title: 'Science (Physics, Chemistry, Biology)', description: 'Integrated science with conceptual and practical understanding.', iconImage: 'symbol:flask', iconBgColor: '#D6F5D6', aliases: ['Science'] },
  { title: 'Social Science', description: 'History, geography, political science, and economics basics.', iconImage: 'symbol:globe', iconBgColor: '#FFF5CC', aliases: ['Social'] },
  { title: 'Hindi', description: 'Hindi language and literature for senior middle school levels.', iconImage: 'symbol:languages', iconBgColor: '#EDE4FF' },
  { title: 'Computer Applications / IT', description: 'Information technology and practical computer applications.', iconImage: 'symbol:monitor', iconBgColor: '#E0F2FE', aliases: ['Computer Science', 'Computer'] },
];

const SENIOR_SECONDARY_SUBJECTS = [
  { title: 'Physics', description: 'Fundamentals of mechanics, waves, electricity, and modern physics.', iconImage: 'symbol:flask', iconBgColor: '#D6F5D6' },
  { title: 'Chemistry', description: 'Atomic structure, reactions, bonding, and chemical principles.', iconImage: 'symbol:flask', iconBgColor: '#D6F5D6' },
  { title: 'Mathematics', description: 'Advanced algebra, calculus, trigonometry, and applications.', iconImage: 'symbol:hash', iconBgColor: '#FFE8D6', aliases: ['Maths'] },
  { title: 'Biology', description: 'Life sciences including botany, zoology, and human biology.', iconImage: 'symbol:leaf', iconBgColor: '#D6F5D6' },
  { title: 'Computer Science', description: 'Programming, computational thinking, and computer systems.', iconImage: 'symbol:monitor', iconBgColor: '#E0F2FE', aliases: ['CS'] },
  { title: 'Accountancy', description: 'Accounting principles, bookkeeping, and financial statements.', iconImage: 'symbol:hash', iconBgColor: '#FFE8D6' },
  { title: 'Business Studies', description: 'Business organization, management, and entrepreneurship basics.', iconImage: 'symbol:activity', iconBgColor: '#E0F2FE', aliases: ['Business'] },
  { title: 'Economics', description: 'Microeconomics, macroeconomics, and market understanding.', iconImage: 'symbol:globe', iconBgColor: '#FFF5CC' },
  { title: 'History', description: 'Historical events, movements, and critical interpretation of the past.', iconImage: 'symbol:book-open', iconBgColor: '#D6EAFF' },
  { title: 'Political Science', description: 'Governance, political systems, and civic institutions.', iconImage: 'symbol:globe', iconBgColor: '#FFF5CC', aliases: ['Political'] },
  { title: 'Geography', description: 'Physical and human geography, maps, and environmental systems.', iconImage: 'symbol:globe', iconBgColor: '#FFF5CC' },
  { title: 'Psychology', description: 'Introduction to human behavior, cognition, and mental processes.', iconImage: 'symbol:sparkles', iconBgColor: '#EDE4FF' },
  { title: 'English', description: 'Advanced language, literature, and communication competence.', iconImage: 'symbol:book-open', iconBgColor: '#D6EAFF' },
];

const SUBJECTS_BY_CLASS = {
  LKG: LKG_UKG_SUBJECTS,
  UKG: LKG_UKG_SUBJECTS,
  '1': PRIMARY_SUBJECTS,
  '2': PRIMARY_SUBJECTS,
  '3': PRIMARY_SUBJECTS,
  '4': PRIMARY_SUBJECTS,
  '5': PRIMARY_SUBJECTS,
  '6': MIDDLE_SUBJECTS,
  '7': MIDDLE_SUBJECTS,
  '8': MIDDLE_SUBJECTS,
  '9': NINTH_TENTH_SUBJECTS,
  '10': NINTH_TENTH_SUBJECTS,
  '11': SENIOR_SECONDARY_SUBJECTS,
  '12': SENIOR_SECONDARY_SUBJECTS,
};

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'els_ai_db',
});

async function upsertSubjectCatalogForOrganization(orgId) {
  const counters = { inserted: 0, updated: 0 };

  for (const [classLevel, templates] of Object.entries(SUBJECTS_BY_CLASS)) {
    for (const template of templates) {
      const aliases = Array.from(
        new Set(
          [template.title, ...(template.aliases || [])]
            .map((value) => value.trim())
            .filter(Boolean),
        ),
      );
      const aliasLower = aliases.map((value) => value.toLowerCase());

      const existing = await pool.query(
        `SELECT id
           FROM subjects
          WHERE organization_id = $1::uuid
            AND class_level = $2
            AND LOWER(title) = ANY($3::text[])
          LIMIT 1`,
        [orgId, classLevel, aliasLower],
      );

      if ((existing.rowCount || 0) > 0) {
        if (DRY_RUN) {
          counters.updated++;
          continue;
        }
        await pool.query(
          `UPDATE subjects
              SET description    = $1,
                  icon_image     = COALESCE(icon_image, $2),
                  icon_bg_color  = COALESCE(icon_bg_color, $3),
                  updated_at     = NOW()
            WHERE id = $4`,
          [template.description, template.iconImage, template.iconBgColor, existing.rows[0].id],
        );
        counters.updated++;
      } else {
        if (DRY_RUN) {
          counters.inserted++;
          continue;
        }
        await pool.query(
          `INSERT INTO subjects
             (organization_id, cover_image, icon_image, icon_bg_color, title, description,
              author, author_user_id, is_external_author, class_level)
           VALUES ($1::uuid, NULL, $2, $3, $4, $5, 'ELS Team', NULL, true, $6)
           ON CONFLICT (organization_id, class_level, title) DO UPDATE
             SET description    = EXCLUDED.description,
                 icon_image     = COALESCE(subjects.icon_image, EXCLUDED.icon_image),
                 icon_bg_color  = COALESCE(subjects.icon_bg_color, EXCLUDED.icon_bg_color),
                 updated_at     = NOW()`,
          [orgId, template.iconImage, template.iconBgColor, template.title, template.description, classLevel],
        );
        counters.inserted++;
      }
    }
  }

  return counters;
}

async function main() {
  console.log(`▶ Subject catalog seeder ${DRY_RUN ? '(DRY RUN)' : ''}`);
  console.log(`  DB ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'els_ai_db'} as ${process.env.DB_USER || 'postgres'}`);

  const orgsResult = ORG_ID_FILTER
    ? await pool.query(`SELECT id, name FROM organizations WHERE id = $1::uuid`, [ORG_ID_FILTER])
    : await pool.query(`SELECT id, name FROM organizations ORDER BY name`);

  if ((orgsResult.rowCount || 0) === 0) {
    console.log('No organizations matched. Nothing to do.');
    return;
  }

  console.log(`Found ${orgsResult.rowCount} organization(s).`);

  const totals = { inserted: 0, updated: 0 };
  for (const org of orgsResult.rows) {
    const before = await pool.query(
      `SELECT COUNT(*)::int AS total FROM subjects WHERE organization_id = $1::uuid`,
      [org.id],
    );
    const beforeCount = Number(before.rows[0]?.total ?? 0);

    process.stdout.write(`  • ${org.name || org.id}  (existing subjects: ${beforeCount}) … `);
    const counters = await upsertSubjectCatalogForOrganization(org.id);
    totals.inserted += counters.inserted;
    totals.updated += counters.updated;

    const after = await pool.query(
      `SELECT COUNT(*)::int AS total FROM subjects WHERE organization_id = $1::uuid`,
      [org.id],
    );
    const afterCount = Number(after.rows[0]?.total ?? 0);

    console.log(`inserted=${counters.inserted}, updated=${counters.updated}, total=${afterCount}`);
  }

  console.log(`\nDone. Total inserted=${totals.inserted}, updated=${totals.updated} ${DRY_RUN ? '(no DB writes – DRY RUN)' : ''}`);
}

main()
  .catch((err) => {
    console.error('\n✖ Subject seeder failed:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
