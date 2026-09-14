import "dotenv/config";
import { z } from "zod";
const EnvSchema = z.object({
    PORT: z.coerce.number().default(4100),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY is required"),
    AGENT_MODEL: z.string().default("claude-sonnet-4-6"),
    INTERNAL_AUTH_SECRET: z.string().optional(),
    EVENT_BUS_URL: z.string().optional(),
    MAX_CONCURRENT_JOBS_PER_USER: z.coerce.number().default(2),
    JOB_TTL_MINUTES: z.coerce.number().default(30),
});
const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
    console.error("[env] Invalid environment configuration:");
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
}
export const env = parsed.data;
//# sourceMappingURL=env.js.map