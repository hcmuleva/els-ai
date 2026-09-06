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
// All static media (audio, images, icons, flags, …) now lives under assets/.
const MEDIA_DIR = process.env.LOCAL_MEDIA_DIR || path.join(ROOT_DIR, 'assets');

const PORT = process.env.PORT || 4000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const CORE_API_URL = process.env.CORE_API_URL || process.env.AUTH_SERVICE_URL || 'http://localhost:4020';
const EDUCATION_AI_API_URL =
  process.env.EDUCATION_AI_API_URL || process.env.AI_SERVICE_URL || 'http://localhost:4003';
const MEDIA_API_URL =
  process.env.MEDIA_API_URL || process.env.MEDIA_SERVICE_URL || 'http://localhost:4004';
const INTERNAL_SECRET = process.env.INTERNAL_SECRET || 'els-internal-secret-change-me';

const PUBLIC_PATH_PREFIXES = ['/auth/login', '/auth/register', '/auth/refresh', '/health', '/media', '/assets/public'];

const app = express();
app.use(cors());

app.use((req, _res, next) => {
  if (req.url === '/api' || req.url.startsWith('/api/')) {
    req.url = req.url.slice(4) || '/';
  }
  next();
});

app.use('/media', express.static(MEDIA_DIR));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'gateway' });
});

function authGuard(req: Request, res: Response, next: NextFunction) {
  const normalizedPath = req.path.replace(/^\/api(?=\/|$)/, '') || '/';
  if (PUBLIC_PATH_PREFIXES.some((prefix) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`))) {
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
    pathRewrite: (incoming) => {
      const normalized = incoming.replace(/^\/api(?=\/|$)/, '') || '/';
      return normalized.startsWith(basePath) ? normalized : `${basePath}${normalized}`;
    },
    on: {
      proxyReq: fixRequestBody,
    },
  });
}

app.use('/auth', makeProxy(CORE_API_URL, '/auth'));
app.use('/users', makeProxy(CORE_API_URL, '/users'));
app.use('/organizations', makeProxy(CORE_API_URL, '/organizations'));
app.use('/billing', makeProxy(CORE_API_URL, '/billing'));
app.use('/classrooms', makeProxy(CORE_API_URL, '/classrooms'));
app.use('/achievements', makeProxy(CORE_API_URL, '/achievements'));
app.use('/questions', makeProxy(CORE_API_URL, '/questions'));
app.use('/question-bank', makeProxy(CORE_API_URL, '/question-bank'));
app.use('/content', makeProxy(CORE_API_URL, '/content'));
app.use('/video-sections', makeProxy(CORE_API_URL, '/video-sections'));
app.use('/bookmarks', makeProxy(CORE_API_URL, '/bookmarks'));
app.use('/topics', makeProxy(CORE_API_URL, '/topics'));
app.use('/catalog/subjects', makeProxy(CORE_API_URL, '/catalog/subjects'));
app.use('/students/subjects', makeProxy(CORE_API_URL, '/students/subjects'));
app.use('/assignments', makeProxy(CORE_API_URL, '/assignments'));
app.use('/students', makeProxy(CORE_API_URL, '/students'));
app.use('/counseling', makeProxy(CORE_API_URL, '/counseling'));
app.use('/feedback', makeProxy(CORE_API_URL, '/feedback'));
app.use('/quizzes', makeProxy(CORE_API_URL, '/quizzes'));
app.use('/ai', makeProxy(EDUCATION_AI_API_URL, '/ai'));
app.use('/ai-conversations', makeProxy(CORE_API_URL, '/ai-conversations'));
app.use('/assets', makeProxy(MEDIA_API_URL, '/assets'));
app.use('/notifications', makeProxy(CORE_API_URL, '/notifications'));
app.use('/stories', makeProxy(CORE_API_URL, '/stories'));

app.listen(PORT, () => {
  console.log(`API Gateway listening on port ${PORT} (${NODE_ENV})`);
});
