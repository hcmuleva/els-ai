import { Router } from 'express';
import { z } from 'zod';
import { isJevConfigured, evaluateWithJev, classifyWithJev, verifyWithJev, } from '../services/jevClient.js';
export const jevRouter = Router();
const EvaluateRequest = z.object({
    state: z.string().min(1, 'State is required'),
    questions: z.record(z.string(), z.object({
        type: z.enum(['boolean', 'choice', 'score']),
        instructions: z.string().min(1),
        choices: z.array(z.string()).optional(),
        scale: z
            .object({
            min: z.number(),
            max: z.number(),
        })
            .optional(),
    })),
});
const ClassifyRequest = z.object({
    text: z.string().min(1),
    choices: z.array(z.string()).min(1),
    instructions: z.string().optional(),
});
const VerifyRequest = z.object({
    content: z.string().min(1),
    criteria: z.string().min(1),
});
// GET /ai/jev/status - Check Jev model status & configuration
jevRouter.get('/status', async (_req, res) => {
    const configured = isJevConfigured();
    res.json({
        service: 'jev',
        model: 'typesafe-ai/jev',
        configured,
        gateway: 'https://ai-gateway.vercel.sh/v1',
        description: 'Jev is TypeSafe AI’s System One evaluation model for fast, structured decisions (choices, scores, and booleans).',
    });
});
// POST /ai/jev/evaluate - Raw parallel evaluation
jevRouter.post('/evaluate', async (req, res) => {
    const parseResult = EvaluateRequest.safeParse(req.body);
    if (!parseResult.success) {
        res.status(400).json({ error: 'Invalid payload', details: parseResult.error.issues });
        return;
    }
    const { state, questions } = parseResult.data;
    const result = await evaluateWithJev(state, questions);
    if (!result.success) {
        res.status(result.raw?.error?.type === 'customer_verification_required' ? 402 : 502).json({
            error: result.error,
            raw: result.raw,
            latencyMs: result.latencyMs,
        });
        return;
    }
    res.json(result);
});
// POST /ai/jev/classify - Categorization helper
jevRouter.post('/classify', async (req, res) => {
    const parseResult = ClassifyRequest.safeParse(req.body);
    if (!parseResult.success) {
        res.status(400).json({ error: 'Invalid payload', details: parseResult.error.issues });
        return;
    }
    const { text, choices, instructions } = parseResult.data;
    const result = await classifyWithJev(text, choices, instructions);
    if (result.error) {
        res.status(502).json({ error: result.error });
        return;
    }
    res.json(result);
});
// POST /ai/jev/verify - Rubric & criteria checking helper
jevRouter.post('/verify', async (req, res) => {
    const parseResult = VerifyRequest.safeParse(req.body);
    if (!parseResult.success) {
        res.status(400).json({ error: 'Invalid payload', details: parseResult.error.issues });
        return;
    }
    const { content, criteria } = parseResult.data;
    const result = await verifyWithJev(content, criteria);
    if (result.error) {
        res.status(502).json({ error: result.error });
        return;
    }
    res.json(result);
});
