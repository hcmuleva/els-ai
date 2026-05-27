import cors from 'cors';
import { config } from 'dotenv';
import express, { NextFunction, Request, Response } from 'express';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';
import path from 'path';
import { fileURLToPath } from 'url';
import { INTERNAL_HEADERS, buildInternalHeaders, verifyJwtPayload } from '@els-ai/internal-auth';

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../..');
const MEDIA_DIR = process.env.LOCAL_MEDIA_DIR || path.join(ROOT_DIR, 'audio-images');
const ASSETS_DIR = process.env.LOCAL_ASSETS_DIR || path.join(ROOT_DIR, 'assets');

const PORT = process.env.PORT || 4000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:4101';
const QUIZ_SERVICE_URL = process.env.QUIZ_SERVICE_URL || 'http://localhost:4002';
const CLASSROOM_SERVICE_URL = process.env.CLASSROOM_SERVICE_URL || 'http://localhost:4006';
const ACHIEVEMENT_SERVICE_URL = process.env.ACHIEVEMENT_SERVICE_URL || 'http://localhost:4007';
const QUESTION_BANK_SERVICE_URL = process.env.QUESTION_BANK_SERVICE_URL || 'http://localhost:4008';
const CONTENT_SERVICE_URL = process.env.CONTENT_SERVICE_URL || 'http://localhost:4009';
const TOPIC_SERVICE_URL = process.env.TOPIC_SERVICE_URL || 'http://localhost:4010';
const ASSIGNMENT_SERVICE_URL = process.env.ASSIGNMENT_SERVICE_URL || 'http://localhost:4011';
const ORG_SERVICE_URL = process.env.ORG_SERVICE_URL || 'http://localhost:4012';
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:4013';
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:4003';
const MEDIA_SERVICE_URL = process.env.MEDIA_SERVICE_URL || 'http://localhost:4004';
const INTERNAL_SECRET = process.env.INTERNAL_SECRET || 'els-internal-secret-change-me';

const PUBLIC_PATH_PREFIXES = ['/auth/login', '/auth/register', '/auth/refresh', '/health', '/media', '/assets/public'];

const app = express();
app.use(cors());

app.use('/media', express.static(MEDIA_DIR));
app.use('/media', express.static(ASSETS_DIR));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'gateway' });
});

function authGuard(req: Request, res: Response, next: NextFunction) {
  if (PUBLIC_PATH_PREFIXES.some((prefix) => req.path === prefix || req.path.startsWith(`${prefix}/`))) {
    return next();
  }
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication token required' });
  }
  const token = authHeader.split(' ')[1];
  const user = verifyJwtPayload(token);
  if (!user) {
    return res.status(401).json({ message: 'Invalid or expired authentication token' });
  }
  const headers = buildInternalHeaders({ ...user, internalSecret: INTERNAL_SECRET });
  Object.entries(headers).forEach(([key, value]) => req.headers[key] = value);
  return next();
}

app.use(authGuard);

function makeProxy(target: string, basePath: string) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: (incoming) => (incoming.startsWith(basePath) ? incoming : `${basePath}${incoming}`),
    on: {
      proxyReq: fixRequestBody,
    },
  });
}

app.use('/auth', makeProxy(AUTH_SERVICE_URL, '/auth'));
app.use('/users', makeProxy(AUTH_SERVICE_URL, '/users'));
app.use('/organizations', makeProxy(ORG_SERVICE_URL, '/organizations'));
app.use('/billing', makeProxy(AUTH_SERVICE_URL, '/billing'));
app.use('/classrooms', makeProxy(CLASSROOM_SERVICE_URL, '/classrooms'));
app.use('/achievements', makeProxy(ACHIEVEMENT_SERVICE_URL, '/achievements'));
app.use('/questions', makeProxy(QUESTION_BANK_SERVICE_URL, '/questions'));
app.use('/question-bank', makeProxy(QUESTION_BANK_SERVICE_URL, '/question-bank'));
app.use('/content', makeProxy(CONTENT_SERVICE_URL, '/content'));
app.use('/topics', makeProxy(TOPIC_SERVICE_URL, '/topics'));
app.use('/catalog/subjects', makeProxy(TOPIC_SERVICE_URL, '/catalog/subjects'));
app.use('/students/subjects', makeProxy(TOPIC_SERVICE_URL, '/students/subjects'));
app.use('/assignments', makeProxy(ASSIGNMENT_SERVICE_URL, '/assignments'));
app.use('/students', makeProxy(AUTH_SERVICE_URL, '/students'));
app.use('/quizzes', makeProxy(QUIZ_SERVICE_URL, '/quizzes'));
app.use('/ai', makeProxy(AI_SERVICE_URL, '/ai'));
app.use('/assets', makeProxy(MEDIA_SERVICE_URL, '/assets'));
app.use('/notifications', makeProxy(NOTIFICATION_SERVICE_URL, '/notifications'));

app.listen(PORT, () => {
  console.log(`API Gateway listening on port ${PORT} (${NODE_ENV})`);
});
