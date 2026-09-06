import cors from 'cors';
import { config } from 'dotenv';
import express from 'express';
import { createTenantContextMiddleware } from '@els-ai/db-tenant';
import { db } from './db.js';
import { requireAuth } from './middleware/auth.js';
import { quizzesRouter } from './routes/quizzes.js';
config();
const PORT = process.env.PORT || 4002;
const tenantContext = createTenantContextMiddleware();
const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'quiz-service' });
});
app.use('/quizzes', requireAuth, tenantContext, quizzesRouter);
async function bootstrap() {
    app.listen(PORT, () => {
        console.log(`Quiz Service listening on http://localhost:${PORT}`);
    });
}
bootstrap().catch(async (error) => {
    console.error('Quiz Service bootstrap failed:', error);
    await db.end();
    process.exit(1);
});
