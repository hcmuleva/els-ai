interface PersistTarget {
  classLevel: string;
  subject: string;
  topicTitle: string;
  isGlobal: boolean;
}

interface PipelineResultLike {
  source_type?: 'youtube' | 'web';
  url?: string;
  title?: string;
  description?: string;
  raw_content?: string;
  status?: string;
  output?: {
    review_status?: string;
  };
}

interface PersistRunOptions {
  gatewayBaseUrl: string;
  authorization: string;
  target: PersistTarget;
  results: PipelineResultLike[];
  persistRejected?: boolean;
}

interface TopicRecord {
  id: string;
  classLevel: string;
  subject: string;
  title: string;
}

interface ContentRecord {
  id: string;
  title: string;
  externalUrl?: string;
}

function normalize(value: unknown): string {
  return String(value ?? '').trim();
}

function lower(value: unknown): string {
  return normalize(value).toLowerCase();
}

function isApproved(result: PipelineResultLike): boolean {
  return result.output?.review_status === 'approved_for_publish';
}

function isRejected(result: PipelineResultLike): boolean {
  return result.status === 'rejected';
}

async function requestJson<T>(
  gatewayBaseUrl: string,
  authorization: string,
  path: string,
  options: { method: 'GET' | 'POST'; body?: unknown },
): Promise<{ status: number; data: T }> {
  const response = await fetch(`${gatewayBaseUrl}${path}`, {
    method: options.method,
    headers: {
      Authorization: authorization,
      'Content-Type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = (await response.json().catch(() => ({}))) as T;
  return { status: response.status, data: payload };
}

async function findExistingTopic(
  gatewayBaseUrl: string,
  authorization: string,
  target: PersistTarget,
): Promise<TopicRecord | null> {
  const searchPath =
    `/topics?class_level=${encodeURIComponent(target.classLevel)}` +
    `&subject=${encodeURIComponent(target.subject)}` +
    `&search=${encodeURIComponent(target.topicTitle)}` +
    '&limit=100';

  const found = await requestJson<{ topics?: TopicRecord[] }>(
    gatewayBaseUrl,
    authorization,
    searchPath,
    { method: 'GET' },
  );

  const topics = found.data.topics || [];
  const match = topics.find(
    (item) =>
      lower(item.title) === lower(target.topicTitle) &&
      lower(item.subject) === lower(target.subject) &&
      lower(item.classLevel) === lower(target.classLevel),
  );
  return match || null;
}

async function ensureTopic(
  gatewayBaseUrl: string,
  authorization: string,
  target: PersistTarget,
): Promise<{ topicId: string; created: boolean }> {
  const created = await requestJson<TopicRecord & { message?: string }>(
    gatewayBaseUrl,
    authorization,
    '/topics',
    {
      method: 'POST',
      body: {
        classLevel: target.classLevel,
        subject: target.subject,
        title: target.topicTitle,
        isGlobal: target.isGlobal,
      },
    },
  );

  if (created.status >= 200 && created.status < 300 && created.data.id) {
    return { topicId: created.data.id, created: true };
  }

  const existing = await findExistingTopic(gatewayBaseUrl, authorization, target);
  if (existing?.id) {
    return { topicId: existing.id, created: false };
  }

  const message = (created.data as { message?: string }).message || 'Failed to create topic';
  throw new Error(message);
}

async function findExistingContent(
  gatewayBaseUrl: string,
  authorization: string,
  target: PersistTarget,
  source: PipelineResultLike,
): Promise<ContentRecord | null> {
  const queryPath =
    `/content/items?class_level=${encodeURIComponent(target.classLevel)}` +
    `&subject=${encodeURIComponent(target.subject)}` +
    `&search=${encodeURIComponent(normalize(source.title))}` +
    '&limit=100';

  const found = await requestJson<{ items?: ContentRecord[] }>(
    gatewayBaseUrl,
    authorization,
    queryPath,
    { method: 'GET' },
  );

  const items = found.data.items || [];
  const srcTitle = lower(source.title);
  const srcUrl = lower(source.url);
  const match = items.find((item) => {
    if (lower(item.title) !== srcTitle) return false;
    if (source.source_type === 'youtube') {
      return lower(item.externalUrl) === srcUrl;
    }
    return true;
  });

  return match || null;
}

function toContentPayload(source: PipelineResultLike, target: PersistTarget, topicId: string) {
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

async function ensureContent(
  gatewayBaseUrl: string,
  authorization: string,
  target: PersistTarget,
  topicId: string,
  source: PipelineResultLike,
): Promise<{ contentId: string; created: boolean }> {
  const existing = await findExistingContent(gatewayBaseUrl, authorization, target, source);
  if (existing?.id) {
    return { contentId: existing.id, created: false };
  }

  const created = await requestJson<{ id?: string; message?: string }>(
    gatewayBaseUrl,
    authorization,
    '/content/items',
    {
      method: 'POST',
      body: toContentPayload(source, target, topicId),
    },
  );

  if (created.status >= 200 && created.status < 300 && created.data.id) {
    return { contentId: created.data.id, created: true };
  }

  throw new Error(created.data.message || 'Failed to create content item');
}

export async function persistPipelineResults(options: PersistRunOptions) {
  const topic = await ensureTopic(options.gatewayBaseUrl, options.authorization, options.target);

  const candidateResults = (options.results || []).filter((item) => {
    if (options.persistRejected) return true;
    return !isRejected(item) && isApproved(item);
  });

  if (candidateResults.length === 0) {
    throw new Error('No approved pipeline results available for persistence');
  }

  const persisted: Array<{ title: string; source_type: string; url: string; contentId: string; created: boolean }> = [];

  for (const item of candidateResults) {
    const sourceType = item.source_type || 'web';
    const title = normalize(item.title);
    const url = normalize(item.url);
    if (!title || !url) {
      continue;
    }

    const content = await ensureContent(
      options.gatewayBaseUrl,
      options.authorization,
      options.target,
      topic.topicId,
      { ...item, source_type: sourceType },
    );

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
