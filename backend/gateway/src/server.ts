import cors from 'cors';
import { config } from 'dotenv';
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import { fileURLToPath } from 'url';

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../..');
const MEDIA_DIR = path.join(ROOT_DIR, 'audio-images');

const PORT = process.env.PORT || 4000;
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:4001';
const QUIZ_SERVICE_URL = process.env.QUIZ_SERVICE_URL || 'http://localhost:4002';
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:4003';

const app = express();
app.use(cors());

// Serve local media assets
app.use('/media', express.static(MEDIA_DIR));

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'gateway' });
});

// Proxy routes
app.use(
  '/auth',
  createProxyMiddleware({
    target: AUTH_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (path) => {
      return path.startsWith('/auth') ? path : `/auth${path}`;
    },
  })
);

app.use(
  '/users',
  createProxyMiddleware({
    target: AUTH_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (path) => {
      return path.startsWith('/users') ? path : `/users${path}`;
    },
  })
);

app.use(
  '/quizzes',
  createProxyMiddleware({
    target: QUIZ_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (path) => {
      return path.startsWith('/quizzes') ? path : `/quizzes${path}`;
    },
  })
);

app.use(
  '/ai',
  createProxyMiddleware({
    target: AI_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (path) => {
      return path.startsWith('/ai') ? path : `/ai${path}`;
    },
  })
);

app.listen(PORT, () => {
  console.log(`API Gateway listening on http://localhost:${PORT}`);
});
