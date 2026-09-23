  import { generateJson } from "./llmClient.js";
import { logger } from "../utils/logger.js";

const CORE_API_URL = process.env.CORE_API_URL || "http://localhost:4020";

export type EntityType = "question" | "content" | "topic" | "quiz";

export interface EntityDiffItem {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  description: string;
}

export interface EntityRevisionResult {
  entityType: EntityType;
  entityId: string;
  originalName: string;
  original: unknown;
  revised: unknown;
  summary: string;
  diff: EntityDiffItem[];
}

function getAuthHeaders(tokenOrHeader?: string): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (tokenOrHeader) {
    headers["Authorization"] = tokenOrHeader.startsWith("Bearer ")
      ? tokenOrHeader
      : `Bearer ${tokenOrHeader}`;
  }
  return headers;
}

/**
 * Fetch a live entity from core-api database.
 */
export async function fetchLiveEntity(
  entityType: EntityType,
  entityId: string,
  authHeader?: string,
): Promise<any> {
  let endpoint = "";
  switch (entityType) {
    case "question":
      endpoint = `${CORE_API_URL}/questions/${encodeURIComponent(entityId)}`;
      break;
    case "content":
      endpoint = `${CORE_API_URL}/content/items/${encodeURIComponent(entityId)}`;
      break;
    case "topic":
      endpoint = `${CORE_API_URL}/topics/${encodeURIComponent(entityId)}/detail`;
      break;
    case "quiz":
      endpoint = `${CORE_API_URL}/quizzes/${encodeURIComponent(entityId)}`;
      break;
    default:
      throw new Error(`Unsupported entity type: ${entityType}`);
  }

  const res = await fetch(endpoint, {
    method: "GET",
    headers: getAuthHeaders(authHeader),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(
      errData.message || `Failed to fetch ${entityType} (${res.status})`,
    );
  }

  return res.json();
}

/**
 * Apply updates directly to core-api.
 */
export async function updateLiveEntity(
  entityType: EntityType,
  entityId: string,
  payload: any,
  authHeader?: string,
): Promise<any> {
  let endpoint = "";
  let method = "PATCH";

  switch (entityType) {
    case "question":
      endpoint = `${CORE_API_URL}/questions/${encodeURIComponent(entityId)}`;
      method = "PATCH";
      break;
    case "content":
      endpoint = `${CORE_API_URL}/content/items/${encodeURIComponent(entityId)}`;
      method = "PUT";
      break;
    case "topic":
      endpoint = `${CORE_API_URL}/topics/${encodeURIComponent(entityId)}`;
      method = "PATCH";
      break;
    case "quiz":
      endpoint = `${CORE_API_URL}/quizzes/${encodeURIComponent(entityId)}`;
      method = "PATCH";
      break;
    default:
      throw new Error(`Unsupported entity type: ${entityType}`);
  }

  const res = await fetch(endpoint, {
    method,
    headers: getAuthHeaders(authHeader),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(
      errData.message || `Failed to update ${entityType} (${res.status})`,
    );
  }

  return res.json();
}

/**
 * Uses LLM to produce a structured revision and diff for an existing entity.
 */
export async function generateEntityRevision(
  entityType: EntityType,
  entityId: string,
  instruction: string,
  authHeader?: string,
): Promise<EntityRevisionResult> {
  const entityData = await fetchLiveEntity(entityType, entityId, authHeader);

  const unwrapped =
    entityData?.question ||
    entityData?.content ||
    entityData?.topic ||
    entityData?.quiz ||
    entityData;

  const originalName =
    unwrapped?.question_title ||
    unwrapped?.questionTitle ||
    unwrapped?.title ||
    unwrapped?.name ||
    `${entityType} #${entityId}`;

  const system = [
    `You are an expert curriculum and educational content editor for school teachers.`,
    `You are revising an existing ${entityType} record based on the teacher's instructions.`,
    `Rules:`,
    `1. Maintain structural compatibility with the existing record schema.`,
    `2. For questions: retain valid options, correct answers, instructions, and explanation format.`,
    `3. For content: retain sections structure (youtube_url, text, etc.).`,
    `4. For topics: retain title, classLevel, subject, etc.`,
    `5. Return ONLY a JSON object with this exact shape:`,
    `{`,
    `  "summary": "1-2 sentence human description of changes",`,
    `  "diff": [`,
    `    { "field": "field_name", "oldValue": "...", "newValue": "...", "description": "why and what changed" }`,
    `  ],`,
    `  "revised": { ...complete updated payload suitable for sending to API... }`,
    `}`,
  ].join("\n");

  const prompt = [
    `Entity Type: ${entityType}`,
    `Current Record:`,
    JSON.stringify(entityData, null, 2),
    ``,
    `Teacher's Instruction:`,
    instruction,
  ].join("\n");

  const llmResponse = await generateJson<{
    summary: string;
    diff: EntityDiffItem[];
    revised: unknown;
  }>({
    system,
    prompt,
    maxTokens: 3500,
  });

  logger.info("entity_revision_generated", {
    entityType,
    entityId,
    diffCount: llmResponse.diff?.length || 0,
  });

  return {
    entityType,
    entityId,
    originalName,
    original: entityData,
    revised: llmResponse.revised,
    summary: llmResponse.summary || `Updated ${entityType} based on instructions`,
    diff: Array.isArray(llmResponse.diff) ? llmResponse.diff : [],
  };
}
