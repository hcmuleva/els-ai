function normalize(value) {
    return String(value ?? '').trim();
}
function lower(value) {
    return normalize(value).toLowerCase();
}
function isApproved(result) {
    return result.output?.review_status === 'approved_for_publish';
}
function isRejected(result) {
    return result.status === 'rejected';
}
async function requestJson(gatewayBaseUrl, authorization, path, options) {
    const response = await fetch(`${gatewayBaseUrl}${path}`, {
        method: options.method,
        headers: {
            Authorization: authorization,
            'Content-Type': 'application/json',
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const payload = (await response.json().catch(() => ({})));
    return { status: response.status, data: payload };
}
async function findExistingTopic(gatewayBaseUrl, authorization, target) {
    const searchPath = `/topics?class_level=${encodeURIComponent(target.classLevel)}` +
        `&subject=${encodeURIComponent(target.subject)}` +
        `&search=${encodeURIComponent(target.topicTitle)}` +
        '&limit=100';
    const found = await requestJson(gatewayBaseUrl, authorization, searchPath, { method: 'GET' });
    const topics = found.data.topics || [];
    const match = topics.find((item) => lower(item.title) === lower(target.topicTitle) &&
        lower(item.subject) === lower(target.subject) &&
        lower(item.classLevel) === lower(target.classLevel));
    return match || null;
}
async function ensureTopic(gatewayBaseUrl, authorization, target) {
    const created = await requestJson(gatewayBaseUrl, authorization, '/topics', {
        method: 'POST',
        body: {
            classLevel: target.classLevel,
            subject: target.subject,
            title: target.topicTitle,
            isGlobal: target.isGlobal,
        },
    });
    if (created.status >= 200 && created.status < 300 && created.data.id) {
        return { topicId: created.data.id, created: true };
    }
    const existing = await findExistingTopic(gatewayBaseUrl, authorization, target);
    if (existing?.id) {
        return { topicId: existing.id, created: false };
    }
    const message = created.data.message || 'Failed to create topic';
    throw new Error(message);
}
async function findExistingContent(gatewayBaseUrl, authorization, target, source) {
    const queryPath = `/content/items?class_level=${encodeURIComponent(target.classLevel)}` +
        `&subject=${encodeURIComponent(target.subject)}` +
        `&search=${encodeURIComponent(normalize(source.title))}` +
        '&limit=100';
    const found = await requestJson(gatewayBaseUrl, authorization, queryPath, { method: 'GET' });
    const items = found.data.items || [];
    const srcTitle = lower(source.title);
    const srcUrl = lower(source.url);
    const match = items.find((item) => {
        if (lower(item.title) !== srcTitle)
            return false;
        if (source.source_type === 'youtube') {
            return lower(item.externalUrl) === srcUrl;
        }
        return true;
    });
    return match || null;
}
function toContentPayload(source, target, topicId) {
    const title = normalize(source.title);
    const url = normalize(source.url);
    const description = normalize(source.description);
    const rawContent = normalize(source.raw_content);
    if (source.source_type === 'youtube') {
        return {
            classLevel: target.classLevel,
            subject: target.subject,
            topicId,
            title,
            isGlobal: target.isGlobal,
            sections: [
                {
                    title: 'Video',
                    contentType: 'youtube_url',
                    externalUrl: url,
                },
            ],
        };
    }
    return {
        classLevel: target.classLevel,
        subject: target.subject,
        topicId,
        title,
        isGlobal: target.isGlobal,
        sections: [
            {
                title: 'Reading',
                contentType: 'text',
                textContent: rawContent || description || url,
            },
        ],
    };
}
async function ensureContent(gatewayBaseUrl, authorization, target, topicId, source) {
    const existing = await findExistingContent(gatewayBaseUrl, authorization, target, source);
    if (existing?.id) {
        return { contentId: existing.id, created: false };
    }
    const created = await requestJson(gatewayBaseUrl, authorization, '/content/items', {
        method: 'POST',
        body: toContentPayload(source, target, topicId),
    });
    if (created.status >= 200 && created.status < 300 && created.data.id) {
        return { contentId: created.data.id, created: true };
    }
    throw new Error(created.data.message || 'Failed to create content item');
}
export async function persistPipelineResults(options) {
    const topic = await ensureTopic(options.gatewayBaseUrl, options.authorization, options.target);
    const candidateResults = (options.results || []).filter((item) => {
        if (options.persistRejected)
            return true;
        return !isRejected(item) && isApproved(item);
    });
    if (candidateResults.length === 0) {
        throw new Error('No approved pipeline results available for persistence');
    }
    const persisted = [];
    for (const item of candidateResults) {
        const sourceType = item.source_type || 'web';
        const title = normalize(item.title);
        const url = normalize(item.url);
        if (!title || !url) {
            continue;
        }
        const content = await ensureContent(options.gatewayBaseUrl, options.authorization, options.target, topic.topicId, { ...item, source_type: sourceType });
        persisted.push({
            title,
            source_type: sourceType,
            url,
            contentId: content.contentId,
            created: content.created,
        });
    }
    return {
        topic: {
            id: topic.topicId,
            created: topic.created,
            classLevel: options.target.classLevel,
            subject: options.target.subject,
            title: options.target.topicTitle,
            isGlobal: options.target.isGlobal,
        },
        persistedCount: persisted.length,
        createdContentCount: persisted.filter((item) => item.created).length,
        reusedContentCount: persisted.filter((item) => !item.created).length,
        items: persisted,
    };
}
