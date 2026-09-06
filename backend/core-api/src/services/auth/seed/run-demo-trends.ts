import { config } from 'dotenv';
import { seedDemoTrends } from './seed-demo-trends.js';
import { db } from '../db.js';

config();

async function run() {
  console.log('Starting demo-trends seed run...');
  await seedDemoTrends();
  console.log('Demo-trends seed run completed!');
  await db.end();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
