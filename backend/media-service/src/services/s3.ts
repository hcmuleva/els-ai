import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

type UploadMediaInput = {
  organizationId: string;
  dataUrl: string;
  fileName: string;
  mimeType?: string;
  mediaType: 'image' | 'audio';
};

type UploadMediaResult = {
  signedUrl: string;
  canonicalUrl: string;
  key: string;
  fileName: string;
  mediaType: 'image' | 'audio';
  mimeType: string;
};

const USE_S3 = String(process.env.USE_S3 || '').toLowerCase() === 'true';
const REGION = process.env.AWS_REGION || process.env.S3_REGION || 'us-east-1';
const BUCKET = process.env.S3_BUCKET_NAME || process.env.AWS_S3_BUCKET || '';
const PUBLIC_BASE_URL = process.env.S3_PUBLIC_BASE_URL || '';
const SIGNED_URL_TTL_SECONDS = Number(process.env.S3_SIGNED_URL_TTL_SECONDS || '3600');

const s3Client = new S3Client({ region: REGION });

const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/aac': 'aac',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
};

function assertS3Configured() {
  if (!USE_S3) {
    throw new Error('USE_S3 must be true to upload media.');
  }
  if (!BUCKET) {
    throw new Error('S3 is not configured. Missing S3_BUCKET_NAME (or AWS_S3_BUCKET).');
  }
}

function sanitizeFileName(fileName: string) {
  return fileName
    .trim()
    .replace(/[^\w.\-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120) || 'uploaded-file';
}

function parseDataUrl(dataUrl: string, overrideMimeType?: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error('Invalid upload format. Expected base64 data URL.');
  }
  const detectedMimeType = match[1];
  const mimeType = (overrideMimeType || detectedMimeType || '').toLowerCase();
  const body = Buffer.from(match[2], 'base64');
  if (!mimeType || body.length === 0) {
    throw new Error('Invalid upload payload.');
  }
  return { mimeType, body };
}

function ensureMediaType(mimeType: string, mediaType: 'image' | 'audio') {
  if (mediaType === 'image' && !mimeType.startsWith('image/')) {
    throw new Error('Uploaded file is not an image.');
  }
  if (mediaType === 'audio' && !mimeType.startsWith('audio/')) {
    throw new Error('Uploaded file is not an audio file.');
  }
}

function getExtension(mimeType: string, originalName: string) {
  const mapped = MIME_EXTENSION_MAP[mimeType];
  if (mapped) return mapped;
  const fromName = originalName.split('.').pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,8}$/.test(fromName)) {
    return fromName;
  }
  return mimeType.startsWith('image/') ? 'png' : 'bin';
}

function buildS3Key(organizationId: string, mediaType: 'image' | 'audio', fileName: string, mimeType: string) {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const safeName = sanitizeFileName(fileName).replace(/\.[^.]+$/, '');
  const extension = getExtension(mimeType, fileName);
  return `els-media/${organizationId}/${mediaType}/${year}/${month}/${randomUUID()}-${safeName}.${extension}`;
}

function buildCanonicalUrl(key: string) {
  if (PUBLIC_BASE_URL) {
    return `${PUBLIC_BASE_URL.replace(/\/+$/, '')}/${key}`;
  }
  return `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
}

function extractKeyFromS3LikeUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('s3://')) {
    const raw = trimmed.slice('s3://'.length);
    const slashIndex = raw.indexOf('/');
    if (slashIndex <= 0) return null;
    const bucket = raw.slice(0, slashIndex);
    const key = raw.slice(slashIndex + 1);
    if (bucket !== BUCKET || !key) return null;
    return key;
  }

  if (PUBLIC_BASE_URL) {
    const normalizedBase = PUBLIC_BASE_URL.replace(/\/+$/, '');
    if (trimmed.startsWith(`${normalizedBase}/`)) {
      return trimmed.slice(normalizedBase.length + 1).split('?')[0].split('#')[0] || null;
    }
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname.replace(/^\/+/, '');
  if (!path) return null;

  const virtualHostedHosts = [
    `${BUCKET}.s3.${REGION}.amazonaws.com`.toLowerCase(),
    `${BUCKET}.s3.amazonaws.com`.toLowerCase(),
  ];
  if (virtualHostedHosts.includes(host)) {
    return decodeURIComponent(path);
  }

  const pathStyleHosts = [`s3.${REGION}.amazonaws.com`.toLowerCase(), 's3.amazonaws.com'];
  if (pathStyleHosts.includes(host)) {
    const [bucket, ...rest] = path.split('/');
    if (bucket === BUCKET && rest.length > 0) {
      return decodeURIComponent(rest.join('/'));
    }
  }

  return null;
}

export function toPersistentMediaUrl(url: string): string {
  const key = extractKeyFromS3LikeUrl(url);
  if (!key) return url;
  return buildCanonicalUrl(key);
}

export async function getSignedMediaUrlIfNeeded(url: string): Promise<string> {
  if (!USE_S3) return url;
  assertS3Configured();

  const key = extractKeyFromS3LikeUrl(url);
  if (!key) return url;

  const expiresIn =
    Number.isFinite(SIGNED_URL_TTL_SECONDS) && SIGNED_URL_TTL_SECONDS > 0 ? SIGNED_URL_TTL_SECONDS : 3600;
  return getSignedUrl(
    s3Client,
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    }),
    { expiresIn },
  );
}

export async function uploadMediaToS3(input: UploadMediaInput): Promise<UploadMediaResult> {
  assertS3Configured();
  const { organizationId, dataUrl, fileName, mimeType: overrideMimeType, mediaType } = input;
  const { mimeType, body } = parseDataUrl(dataUrl, overrideMimeType);
  ensureMediaType(mimeType, mediaType);

  const key = buildS3Key(organizationId, mediaType, fileName, mimeType);
  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: mimeType,
    }),
  );

  const canonicalUrl = buildCanonicalUrl(key);
  const signedUrl = await getSignedMediaUrlIfNeeded(canonicalUrl);
  return {
    signedUrl,
    canonicalUrl,
    key,
    fileName: sanitizeFileName(fileName),
    mediaType,
    mimeType,
  };
}
