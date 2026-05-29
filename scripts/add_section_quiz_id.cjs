const { Pool } = require('pg');
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'els_ai_db',
});

async function main() {
  try {
    await pool.query(
      `ALTER TABLE learning_content_sections ADD COLUMN IF NOT EXISTS quiz_id UUID;`,
    );
    console.log('✓ quiz_id column ensured on learning_content_sections');
    const check = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'learning_content_sections' AND column_name = 'quiz_id'`,
    );
    console.log('verify:', check.rowCount === 1 ? 'present' : 'MISSING');
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}
main();
