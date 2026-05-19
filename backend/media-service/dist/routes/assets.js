import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { getSignedMediaUrlIfNeeded, toPersistentMediaUrl, uploadMediaToS3 } from '../services/s3.js';
const uploadAssetSchema = z.object({
    dataUrl: z.string().trim().min(1),
    fileName: z.string().trim().min(1).max(255),
    mimeType: z.string().trim().optional(),
    mediaType: z.enum(['image', 'audio']),
    context: z.string().trim().optional(),
});
const resolveUrlSchema = z.object({
    url: z.string().trim().min(1),
});
const resolveBatchSchema = z.object({
    urls: z.array(z.string().trim().min(1)).min(1).max(200),
});
export const assetsRouter = Router();
function getOrganizationId(req) {
    return req.user?.organizationId || null;
}
assetsRouter.post('/upload', requireAuth, async (req, res) => {
    const parsedBody = uploadAssetSchema.safeParse(req.body);
    if (!parsedBody.success) {
        return res.status(400).json({ message: 'Invalid upload payload', errors: parsedBody.error.issues });
    }
    const organizationId = getOrganizationId(req);
    if (!organizationId) {
        return res.status(400).json({ message: 'Organization not found in auth context' });
    }
    const { dataUrl, fileName, mimeType, mediaType, context } = parsedBody.data;
    try {
        const uploaded = await uploadMediaToS3({
            organizationId,
            dataUrl,
            fileName,
            mimeType,
            mediaType,
        });
        const metadata = {
            key: uploaded.key,
            mimeType: uploaded.mimeType,
            originalFileName: fileName,
            storedFileName: uploaded.fileName,
            uploadedBy: req.user?.userId || null,
            context: context || null,
        };
        const insertResult = await db.query(`INSERT INTO assets (organization_id, asset_type, file_url, metadata)
       VALUES ($1::uuid, $2, $3, $4::jsonb)
       RETURNING id`, [organizationId, mediaType, uploaded.canonicalUrl, metadata]);
        return res.status(201).json({
            assetId: insertResult.rows[0].id,
            url: uploaded.signedUrl,
            canonicalUrl: uploaded.canonicalUrl,
            fileName: uploaded.fileName,
            mediaType: uploaded.mediaType,
            mimeType: uploaded.mimeType,
            key: uploaded.key,
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to upload media';
        const isClientError = message.includes('Invalid upload format') ||
            message.includes('Invalid upload payload') ||
            message.includes('not an image') ||
            message.includes('not an audio');
        return res.status(isClientError ? 400 : 500).json({ message });
    }
});
assetsRouter.post('/resolve', requireAuth, async (req, res) => {
    const parsedBody = resolveUrlSchema.safeParse(req.body);
    if (!parsedBody.success) {
        return res.status(400).json({ message: 'Invalid resolve payload', errors: parsedBody.error.issues });
    }
    try {
        const canonicalUrl = toPersistentMediaUrl(parsedBody.data.url);
        const signedUrl = await getSignedMediaUrlIfNeeded(canonicalUrl);
        return res.json({ url: signedUrl, canonicalUrl });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to resolve media URL';
        return res.status(500).json({ message });
    }
});
assetsRouter.post('/resolve/batch', requireAuth, async (req, res) => {
    const parsedBody = resolveBatchSchema.safeParse(req.body);
    if (!parsedBody.success) {
        return res.status(400).json({ message: 'Invalid batch resolve payload', errors: parsedBody.error.issues });
    }
    try {
        const resolved = await Promise.all(parsedBody.data.urls.map(async (inputUrl) => {
            const canonicalUrl = toPersistentMediaUrl(inputUrl);
            const signedUrl = await getSignedMediaUrlIfNeeded(canonicalUrl);
            return { sourceUrl: inputUrl, canonicalUrl, url: signedUrl };
        }));
        return res.json({ items: resolved });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to resolve media URLs';
        return res.status(500).json({ message });
    }
});
assetsRouter.get('/:assetId', requireAuth, async (req, res) => {
    const organizationId = getOrganizationId(req);
    if (!organizationId) {
        return res.status(400).json({ message: 'Organization not found in auth context' });
    }
    const { assetId } = req.params;
    try {
        const result = await db.query(`SELECT id, organization_id, asset_type, file_url, metadata, created_at
       FROM assets
       WHERE id = $1::uuid AND organization_id = $2::uuid`, [assetId, organizationId]);
        if ((result.rowCount ?? 0) === 0) {
            return res.status(404).json({ message: 'Asset not found' });
        }
        const asset = result.rows[0];
        const canonicalUrl = toPersistentMediaUrl(asset.file_url);
        const signedUrl = await getSignedMediaUrlIfNeeded(canonicalUrl);
        return res.json({
            id: asset.id,
            organizationId: asset.organization_id,
            mediaType: asset.asset_type,
            url: signedUrl,
            canonicalUrl,
            metadata: asset.metadata,
            createdAt: asset.created_at,
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to fetch asset';
        return res.status(500).json({ message });
    }
});
