import { config } from 'dotenv';
import { initSchemaAndSeed } from './seed.js';
import { db } from '../db.js';
config();
process.env.RESET_DB_ON_START = 'true';
async function run() {
    console.log('Starting seed run...');
    await initSchemaAndSeed();
    console.log('Seed run completed!');
    await db.end();
    process.exit(0);
}
run().catch((err) => {
    console.error(err);
    process.exit(1);
});
