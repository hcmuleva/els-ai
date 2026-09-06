function getBaseUrl(options) {
    return (options?.baseUrl || process.env.MEDIA_SERVICE_URL || 'http://localhost:4004').replace(/\/+$/, '');
}
function getInternalSecret(options) {
    return options?.internalSecret || process.env.INTERNAL_SECRET || 'els-internal-secret-change-me';
}
function buildHeaders(options) {
    const headers = {
        'content-type': 'application/json',
        'x-internal-secret': getInternalSecret(options),
    };
    if (options?.userId)
        headers['x-internal-user-id'] = options.userId;
    return headers;
}
async function postJson(path, body, options) {
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
    return (await response.json());
}
export async function uploadMediaToS3(input, options) {
    return postJson('/assets/internal/upload', input, options);
}
export async function getSignedMediaUrlIfNeeded(url, options) {
    if (!url)
        return url;
    try {
        const result = await postJson('/assets/internal/resolve', { url }, options);
        return result.url || result.signedUrl || url;
    }
    catch (error) {
        console.warn('[media-client] resolve failed, returning canonical url:', error.message);
        return url;
    }
}
export async function resolveSignedMediaUrls(urls, options) {
    if (urls.length === 0)
        return [];
    try {
        const result = await postJson('/assets/internal/resolve/batch', { urls }, options);
        return result.items;
    }
    catch (error) {
        console.warn('[media-client] batch resolve failed:', error.message);
        return urls.map((sourceUrl) => ({ sourceUrl, canonicalUrl: sourceUrl, url: sourceUrl }));
    }
}
export function toPersistentMediaUrl(url) {
    return url;
}
export async function canonicalizeMediaUrl(url, options) {
    if (!url)
        return url;
    try {
        const result = await postJson('/assets/internal/canonicalize', { url }, options);
        return result.canonicalUrl || url;
    }
    catch {
        return url;
    }
}
