import cors from 'cors';
import { config } from 'dotenv';
import express from 'express';
import { aiRouter } from './routes/ai.js';
config();
const PORT = process.env.PORT || 4003;
const app = express();
app.use(cors());
app.use(express.json());
// Health check
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'ai-service' });
});
app.use('/ai', aiRouter);
async function bootstrap() {
    app.listen(PORT, () => {
        console.log(`AI Service listening on http://localhost:${PORT}`);
    });
}
bootstrap().catch((error) => {
    console.error('AI Service bootstrap failed:', error);
    process.exit(1);
});
