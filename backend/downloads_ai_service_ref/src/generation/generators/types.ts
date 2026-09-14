export interface GeneratorResult {
  /** Persisted entity id — this is what "search it and see" resolves to. */
  contentId: string;
  /** Human-readable name shown next to the green checkmark. */
  name: string;
  /** Small payload the chat UI renders inline as a preview. */
  preview: unknown;
  /** Full generated payload, persisted to the content DB. */
  data: unknown;
}
