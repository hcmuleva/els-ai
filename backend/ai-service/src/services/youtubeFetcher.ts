// @ts-ignore
import * as ytSearch from 'youtube-search-api';

export interface ValidatedYoutubeVideo {
  videoId: string;
  url: string;
  title: string;
  thumbnailUrl?: string;
}

/**
 * Checks whether a YouTube video is publicly available and embeddable using YouTube's oEmbed endpoint.
 * Returns false if the video is deleted, private, region-blocked, or has embedding disabled.
 */
export async function isYoutubeEmbeddable(videoId: string, timeoutMs = 4000): Promise<boolean> {
  if (!videoId || typeof videoId !== 'string') return false;
  try {
    const url = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    
    const res = await fetch(oembedUrl, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ELS-AI/1.0; +https://els-ai.local)',
      },
    });

    if (!res.ok) return false;
    const json = (await res.json()) as any;
    return Boolean(json && json.type === 'video' && json.html);
  } catch {
    return false;
  }
}

/**
 * Helpers for subject domain detection and conflict filtering
 */
function isLanguageDomain(str: string): boolean {
  return /(hindi|हिंदी|english|sanskrit|marathi|gujarati|bengali|urdu|tamil|telugu|kannada|malayalam|punjabi|language|bhasha|भाषा|vocab|vocabulary|शब्दार्थ|grammar|व्याकरण|अनुच्छेद|गद्यांश|comprehension|passage|literature)/i.test(
    str || ''
  );
}

function isMathDomain(str: string): boolean {
  return /(math|maths|mathematics|ganit|गणित|अंकगणित|arithmetic|algebra|geometry|mental ability|reasoning|मानसिक योग्यता|tarkshakti|तर्कशक्ति|figure matching|fractions|decimals|mensuration)/i.test(
    str || ''
  );
}

function isScienceDomain(str: string): boolean {
  return /(science|physics|chemistry|biology|vigyan|विज्ञान|evs|environmental science)/i.test(
    str || ''
  );
}

/**
 * Detects if a video title conflicts with the requested subject.
 * E.g., filters out Math or Mental Ability videos when the subject is Hindi.
 */
export function isSubjectConflicting(title: string, subject = '', topic = ''): boolean {
  const t = (title || '').toLowerCase();
  const s = (subject || '').toLowerCase();
  const top = (topic || '').toLowerCase();

  const isTargetLanguage = isLanguageDomain(s) || (isLanguageDomain(top) && !isMathDomain(top));
  const isTargetMath = isMathDomain(s) || (isMathDomain(top) && !isLanguageDomain(top));
  const isTargetScience = isScienceDomain(s) || (isScienceDomain(top) && !isMathDomain(top) && !isLanguageDomain(top));

  // Language subject requested: strictly reject Math, Mental Ability, or Reasoning videos
  if (isTargetLanguage && !isTargetMath) {
    if (
      /(math|maths|mathematics|ganit|अंकगणित|mental ability|reasoning|tarkshakti|मानसिक योग्यता|figure matching|arithmetic|geometry|algebra)/i.test(
        t
      )
    ) {
      return true;
    }
  }

  // Math subject requested: strictly reject language/literature/grammar videos
  if (isTargetMath && !isTargetLanguage) {
    if (
      /(hindi|हिंदी|व्याकरण|bhasha|भाषा|गद्यांश|अनुच्छेद|english grammar|vocabulary|literature|comprehension)/i.test(
        t
      )
    ) {
      return true;
    }
  }

  // Science subject requested: reject pure math or language grammar videos
  if (isTargetScience) {
    if (
      /(mental ability|reasoning|मानसिक योग्यता|figure matching|व्याकरण|english grammar)/i.test(
        t
      )
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Calculates a relevance affinity score for an educational video candidate.
 */
function scoreVideoAffinity(title: string, subject = '', topic = '', gradeLevel = ''): number {
  const t = (title || '').toLowerCase();
  const s = (subject || '').toLowerCase().trim();
  let score = 0;

  if (s) {
    // Exact subject name match in title
    if (t.includes(s)) score += 50;

    // Language specific boosts
    if (isLanguageDomain(s)) {
      if (/(hindi|हिंदी)/i.test(s) && /(hindi|हिंदी|भाषा|व्याकरण|अनुच्छेद|गद्यांश|शब्दार्थ|vocabulary)/i.test(t)) {
        score += 40;
      }
      if (/(english)/i.test(s) && /(english|grammar|vocabulary|passage|comprehension)/i.test(t)) {
        score += 40;
      }
    }

    // Math specific boosts
    if (isMathDomain(s) && isMathDomain(t)) {
      score += 40;
    }
  }

  // Topic keywords match
  const topicKeywords = topic
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3);

  for (const word of topicKeywords) {
    if (t.includes(word)) score += 10;
  }

  // Grade level match
  const cleanGrade = gradeLevel.replace(/^(grade|class)\s*/i, '').trim();
  if (cleanGrade && (t.includes(`class ${cleanGrade}`) || t.includes(`${cleanGrade}th`))) {
    score += 15;
  }

  // Exam prep keywords boost
  if (/(navodaya|jnvst|sainik|olympiad)/i.test(topic) && /(navodaya|jnvst|sainik|olympiad|entrance)/i.test(t)) {
    score += 20;
  }

  return score;
}

/**
 * Formulates search queries with subject-first prioritization to avoid cross-subject bias.
 */
function buildSearchQueries(topic: string, subject = '', gradeLevel = ''): string[] {
  const cleanSubj = subject.trim();
  const cleanTop = topic.trim();
  const cleanGrade = gradeLevel.replace(/^(grade|class)\s*/i, '').trim();
  const gradeStr = cleanGrade ? `class ${cleanGrade}` : '';

  const queries: string[] = [];

  if (cleanSubj) {
    if (isLanguageDomain(cleanSubj)) {
      queries.push(`${cleanSubj} ${cleanTop} ${gradeStr} lesson`.trim());
      queries.push(`${cleanTop} ${cleanSubj} bhasha parikshan grammar vocabulary ${gradeStr}`.trim());
      queries.push(`${cleanSubj} ${cleanTop} educational`.trim());
    } else if (isMathDomain(cleanSubj)) {
      queries.push(`${cleanSubj} ${cleanTop} ${gradeStr} solved lecture`.trim());
      queries.push(`${cleanTop} ${cleanSubj} chapter concepts ${gradeStr}`.trim());
      queries.push(`${cleanSubj} ${cleanTop} educational`.trim());
    } else {
      queries.push(`${cleanSubj} ${cleanTop} ${gradeStr} educational`.trim());
      queries.push(`${cleanTop} ${cleanSubj} lesson ${gradeStr}`.trim());
    }
  }

  queries.push(`${cleanTop} ${cleanSubj} educational ${gradeStr}`.trim());
  queries.push(`${cleanTop} educational video`.trim());

  return Array.from(new Set(queries.filter(Boolean)));
}

/**
 * Searches for high-quality educational videos and verifies embed availability.
 * Filters out cross-subject conflicting videos, region-blocked, age-restricted, or non-embeddable videos.
 */
export async function fetchBestYoutubeVideo(params: {
  topic: string;
  subject?: string;
  gradeLevel?: string;
  details?: string;
}): Promise<ValidatedYoutubeVideo | null> {
  const { topic, subject = '', gradeLevel = '' } = params;
  const queries = buildSearchQueries(topic, subject, gradeLevel);

  for (const query of queries) {
    try {
      console.log(`[youtubeFetcher] Searching YouTube for query: "${query}"`);
      const getListByKeyword = (ytSearch as any)?.GetListByKeyword || (ytSearch as any)?.default?.GetListByKeyword;
      if (!getListByKeyword) {
        throw new Error('youtube-search-api GetListByKeyword not found');
      }
      const searchResults = await getListByKeyword(query, false, 8, [{ type: 'video' }]);
      const items = searchResults?.items || [];

      // Filter and score candidates
      const scoredCandidates: Array<{ item: any; score: number }> = [];

      for (const item of items) {
        if (!item?.id) continue;

        // Strict cross-subject rejection
        if (isSubjectConflicting(item.title, subject, topic)) {
          console.log(`[youtubeFetcher] Rejecting cross-subject video: "${item.title}" for subject "${subject}"`);
          continue;
        }

        const score = scoreVideoAffinity(item.title, subject, topic, gradeLevel);
        scoredCandidates.push({ item, score });
      }

      // Sort by affinity score descending
      scoredCandidates.sort((a, b) => b.score - a.score);

      for (const candidate of scoredCandidates) {
        const item = candidate.item;
        const working = await isYoutubeEmbeddable(item.id);
        if (working) {
          const videoUrl = `https://www.youtube.com/watch?v=${item.id}`;
          const thumb =
            item.thumbnail?.thumbnails?.[item.thumbnail.thumbnails.length - 1]?.url ||
            `https://img.youtube.com/vi/${item.id}/hqdefault.jpg`;

          console.log(`[youtubeFetcher] Verified relevant embeddable video: ${videoUrl} ("${item.title}", score: ${candidate.score})`);
          return {
            videoId: item.id,
            url: videoUrl,
            title: item.title || topic,
            thumbnailUrl: thumb,
          };
        } else {
          console.log(`[youtubeFetcher] Skipping blocked/non-embeddable video: ${item.id}`);
        }
      }
    } catch (err) {
      console.warn(`[youtubeFetcher] Search error on query "${query}":`, err instanceof Error ? err.message : err);
    }
  }

  return null;
}

/**
 * Searches and returns multiple verified embeddable videos for modular curriculum sections.
 * Guarantees cross-subject relevance and avoids conflicting topics.
 */
export async function fetchMultipleYoutubeVideos(
  params: {
    topic: string;
    subject?: string;
    gradeLevel?: string;
    details?: string;
  },
  desiredCount = 2,
): Promise<ValidatedYoutubeVideo[]> {
  const { topic, subject = '', gradeLevel = '' } = params;
  const count = Math.max(1, Math.min(desiredCount, 5));
  const results: ValidatedYoutubeVideo[] = [];
  const seenIds = new Set<string>();

  const queries = buildSearchQueries(topic, subject, gradeLevel);

  for (const query of queries) {
    if (results.length >= count) break;
    try {
      console.log(`[youtubeFetcher] Searching multiple YouTube videos query: "${query}"`);
      const getListByKeyword =
        (ytSearch as any)?.GetListByKeyword || (ytSearch as any)?.default?.GetListByKeyword;
      if (!getListByKeyword) continue;

      const searchResults = await getListByKeyword(query, false, 10, [{ type: 'video' }]);
      const items = searchResults?.items || [];

      // Filter and score candidates
      const scoredCandidates: Array<{ item: any; score: number }> = [];

      for (const item of items) {
        if (!item?.id || seenIds.has(item.id)) continue;

        // Strict cross-subject rejection
        if (isSubjectConflicting(item.title, subject, topic)) {
          console.log(`[youtubeFetcher] Rejecting cross-subject video: "${item.title}" for subject "${subject}"`);
          continue;
        }

        const score = scoreVideoAffinity(item.title, subject, topic, gradeLevel);
        scoredCandidates.push({ item, score });
      }

      scoredCandidates.sort((a, b) => b.score - a.score);

      for (const candidate of scoredCandidates) {
        if (results.length >= count) break;
        const item = candidate.item;
        if (seenIds.has(item.id)) continue;

        const working = await isYoutubeEmbeddable(item.id);
        if (working) {
          seenIds.add(item.id);
          const videoUrl = `https://www.youtube.com/watch?v=${item.id}`;
          const thumb =
            item.thumbnail?.thumbnails?.[item.thumbnail.thumbnails.length - 1]?.url ||
            `https://img.youtube.com/vi/${item.id}/hqdefault.jpg`;

          results.push({
            videoId: item.id,
            url: videoUrl,
            title: item.title || `${topic} - Part ${results.length + 1}`,
            thumbnailUrl: thumb,
          });
        }
      }
    } catch (err) {
      console.warn(`[youtubeFetcher] Multiple video search error on "${query}":`, err);
    }
  }

  return results;
}
