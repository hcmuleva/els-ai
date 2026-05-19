import { config } from 'dotenv';
import { Pool } from 'pg';
import { z } from 'zod';

config();

const envSchema = z.object({
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().default(5432),
  DB_USER: z.string().default('postgres'),
  DB_PASSWORD: z.string().default('postgres'),
  DB_NAME: z.string().default('els_ai_db'),
});

const env = envSchema.parse(process.env);

export const db = new Pool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
});
