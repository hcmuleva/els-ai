const { Pool } = require('pg');
const pool = new Pool({
  user: 'postgres',
  password: 'postgres',
  host: 'localhost',
  port: 5432,
  database: 'els_ai_db'
});
async function main() {
  try {
    await pool.query('ALTER TABLE learning_content_sections ADD COLUMN IF NOT EXISTS title VARCHAR(255);');
    console.log('Column title added to learning_content_sections');
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
main();
