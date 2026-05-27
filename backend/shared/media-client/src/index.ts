export type MediaType = 'image' | 'audio' | 'video';

export type UploadMediaInput = {
  organizationId: string;
  dataUrl: string;
  fileName: string;
  mimeType?: string;
  mediaType: MediaType;
};

export type UploadMediaResult = {
  url: string;
  signedUrl: string;
  canonicalUrl: string;
  key: string;
  fileName: string;
  mediaType: MediaType;
  mimeType: string;
  assetId?: string;
};

type ClientOptions = {
  baseUrl?: string;
  internalSecret?: string;
  userId?: string;
};

function getBaseUrl(options?: ClientOptions) {
  return (options?.baseUrl || process.env.MEDIA_SERVICE_URL || 'http://localhost:4004').replace(/\/+$/, '');
}

function getInternalSecret(options?: ClientOptions) {
  return options?.internalSecret || process.env.INTERNAL_SECRET || 'els-internal-secret-change-me';
}

function buildHeaders(options?: ClientOptions): Record<string, string> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-internal-secret': getInternalSecret(options),
  };
  if (options?.userId) headers['x-internal-user-id'] = options.userId;
  return headers;
}

async function postJson<T>(path: string, body: unknown, options?: ClientOptions): Promise<T> {
  const url = `${getBaseUrl(options)}${path}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(options),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`media-service ${path} failed: ${response.status} ${text}`);
  }
  return (await response.json()) as T;
}

export async function uploadMediaToS3(input: UploadMediaInput, options?: ClientOptions): Promise<UploadMediaResult> {
  return postJson<UploadMediaResult>('/assets/internal/upload', input, options);
}

export async function getSignedMediaUrlIfNeeded(url: string, options?: ClientOptions): Promise<string> {
  if (!url) return url;
  try {
    const result = await postJson<{ url: string; signedUrl: string; canonicalUrl: string }>(
      '/assets/internal/resolve',
      { url },
      options,
    );
    return result.url || result.signedUrl || url;
  } catch (error) {
    console.warn('[media-client] resolve failed, returning canonical url:', (error as Error).message);
    return url;
  }
}

export async function resolveSignedMediaUrls(
  urls: string[],
  options?: ClientOptions,
): Promise<Array<{ sourceUrl: string; canonicalUrl: string; url: string }>> {
  if (urls.length === 0) return [];
  try {
    const result = await postJson<{ items: Array<{ sourceUrl: string; canonicalUrl: string; url: string }> }>(
      '/assets/internal/resolve/batch',
      { urls },
      options,
    );
    return result.items;
  } catch (error) {
    console.warn('[media-client] batch resolve failed:', (error as Error).message);
    return urls.map((sourceUrl) => ({ sourceUrl, canonicalUrl: sourceUrl, url: sourceUrl }));
  }
}

export function toPersistentMediaUrl(url: string): string {
  return url;
}

export async function canonicalizeMediaUrl(url: string, options?: ClientOptions): Promise<string> {
  if (!url) return url;
  try {
    const result = await postJson<{ canonicalUrl: string }>('/assets/internal/canonicalize', { url }, options);
    return result.canonicalUrl || url;
  } catch {
    return url;
  }
}
