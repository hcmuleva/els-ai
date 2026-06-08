export const SUPPORTED_SUBJECTS = [
    'DoYouKnow',
    'TipsTricks',
    'HowToThink',
    'Story',
    'Creativity',
    'Dharm',
    'Puzzle',
    'JrScientist',
    'HowThingsWork',
    'MemoryDevelopment',
    'DIY',
];
const HARMFUL_KEYWORDS = ['violence', 'kill', 'suicide', 'terror', 'abuse', 'porn', 'explicit', 'hate', 'drugs'];
const HINDU_KEYWORDS = [
    'hindu',
    'sanatan',
    'veda',
    'ramayana',
    'mahabharata',
    'krishna',
    'ram',
    'ganesha',
    'shiva',
    'vishnu',
    'devi',
    'bhagavad gita',
    'upanishad',
    'temple',
    'puja',
];
const SUBJECT_KEYWORDS = {
    DoYouKnow: ['fact', 'did you know', 'interesting', 'knowledge'],
    TipsTricks: ['tips', 'tricks', 'hack', 'shortcut'],
    HowToThink: ['critical thinking', 'logic', 'reasoning', 'analyze'],
    Story: ['story', 'tale', 'character', 'moral'],
    Creativity: ['creative', 'drawing', 'art', 'imagination'],
    Dharm: ['hindu', 'dharma', 'gita', 'vedic', 'sanatan'],
    Puzzle: ['puzzle', 'riddle', 'solve', 'brain teaser'],
    JrScientist: ['experiment', 'science', 'observe', 'hypothesis'],
    HowThingsWork: ['how it works', 'machine', 'system', 'mechanism'],
    MemoryDevelopment: ['memory', 'recall', 'focus', 'mnemonic'],
    DIY: ['diy', 'make at home', 'craft', 'build'],
};
const CLASS_BANDS = [
    { min: 0, max: 120, label: 'LKG' },
    { min: 121, max: 220, label: 'Class 1' },
    { min: 221, max: 320, label: 'Class 2' },
    { min: 321, max: 420, label: 'Class 3' },
    { min: 421, max: 520, label: 'Class 4' },
    { min: 521, max: 620, label: 'Class 5' },
    { min: 621, max: 700, label: 'Class 6' },
    { min: 701, max: 780, label: 'Class 7' },
    { min: 781, max: 860, label: 'Class 8' },
    { min: 861, max: 940, label: 'Class 9' },
    { min: 941, max: 1020, label: 'Class 10' },
    { min: 1021, max: 1110, label: 'Class 11' },
    { min: 1111, max: 1200, label: 'Class 12' },
];
function normalizeText(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
}
function includesAnyKeyword(text, keywords) {
    const normalized = normalizeText(text).toLowerCase();
    return keywords.some((k) => normalized.includes(k.toLowerCase()));
}
function detectLanguage(text) {
    const sample = normalizeText(text);
    if (!sample)
        return { language: 'English', confidence: 0.5 };
    const devanagariChars = (sample.match(/[\u0900-\u097F]/g) || []).length;
    const latinChars = (sample.match(/[A-Za-z]/g) || []).length;
    if (devanagariChars > latinChars * 0.3)
        return { language: 'Hindi', confidence: 0.86 };
    return { language: 'English', confidence: 0.86 };
}
function tokenizeCount(text) {
    return normalizeText(text).split(' ').filter(Boolean).length;
}
function clampScore(value) {
    return Math.max(0, Math.min(1, Number(value.toFixed(3))));
}
function normalizeUrl(inputUrl) {
    try {
        const url = new URL(inputUrl);
        url.hash = '';
        if (url.hostname.startsWith('www.'))
            url.hostname = url.hostname.slice(4);
        if (url.pathname.endsWith('/'))
            url.pathname = url.pathname.slice(0, -1);
        return url.toString();
    }
    catch {
        return '';
    }
}
function isYoutubeUrl(inputUrl) {
    try {
        const hostname = new URL(inputUrl).hostname.toLowerCase();
        return hostname.includes('youtube.com') || hostname.includes('youtu.be');
    }
    catch {
        return false;
    }
}
function complexityFromScore(score) {
    if (score < 0.34)
        return 'low';
    if (score < 0.67)
        return 'medium';
    return 'high';
}
function bandFromDifficultySignal(signal) {
    const band = CLASS_BANDS.find((candidate) => signal >= candidate.min && signal <= candidate.max);
    return band ? band.label : 'Class 6';
}
function scoreSubjects(text) {
    const normalized = text.toLowerCase();
    const scored = {};
    for (const subject of SUPPORTED_SUBJECTS) {
        const keywords = SUBJECT_KEYWORDS[subject];
        const matches = keywords.reduce((count, keyword) => count + (normalized.includes(keyword.toLowerCase()) ? 1 : 0), 0);
        scored[subject] = Math.max(0.2, matches / Math.max(keywords.length, 1));
    }
    return scored;
}
function calculateDifficultySignal(text, durationSeconds) {
    const tokenSignal = tokenizeCount(text);
    const durationSignal = Math.min(durationSeconds, 1200);
    const punctuationSignal = Math.min((text.match(/[,:;()]/g) || []).length * 3, 150);
    return Math.min(tokenSignal + durationSignal + punctuationSignal, 1200);
}
function failValidation(reason, confidence) {
    return {
        is_valid: false,
        failure_reason: reason,
        validated_duration_seconds: 0,
        validation_confidence: confidence,
    };
}
export function runContentPipeline(request) {
    if (!SUPPORTED_SUBJECTS.includes(request.subject)) {
        throw new Error(`Unsupported subject: ${request.subject}`);
    }
    const seenUrls = new Set();
    const results = [];
    for (const candidate of request.candidates || []) {
        const url = normalizeUrl(candidate.url);
        const sourceType = candidate.source_type || (isYoutubeUrl(url) ? 'youtube' : 'web');
        const mergedText = normalizeText(`${candidate.title || ''} ${candidate.description || ''} ${candidate.raw_content || ''}`);
        const languageFromIngestion = detectLanguage(mergedText);
        const ingested = {
            source_type: sourceType,
            url,
            title: normalizeText(candidate.title),
            description: normalizeText(candidate.description),
            duration_seconds: Number(candidate.duration_seconds || 0),
            raw_content: normalizeText(candidate.raw_content),
            youtube_meta: {
                is_public: candidate.youtube_meta?.is_public ?? false,
                is_embeddable: candidate.youtube_meta?.is_embeddable ?? false,
                is_age_restricted: candidate.youtube_meta?.is_age_restricted ?? false,
            },
            ingestion_confidence: languageFromIngestion.confidence,
        };
        const normalizedBody = normalizeText(`${ingested.title} ${ingested.description} ${ingested.raw_content}`);
        let validationResult;
        if (!ingested.url) {
            validationResult = failValidation('Invalid or empty URL', 0.99);
        }
        else if (seenUrls.has(ingested.url)) {
            validationResult = failValidation('Duplicate URL', 0.99);
        }
        else if (includesAnyKeyword(normalizedBody, HARMFUL_KEYWORDS)) {
            validationResult = failValidation('Harmful or inappropriate content detected', 0.96);
        }
        else if (sourceType === 'youtube' && !ingested.youtube_meta.is_public) {
            validationResult = failValidation('YouTube video is not public', 0.98);
        }
        else if (sourceType === 'youtube' && !ingested.youtube_meta.is_embeddable) {
            validationResult = failValidation('YouTube embedding is disabled', 0.98);
        }
        else if (sourceType === 'youtube' && ingested.youtube_meta.is_age_restricted) {
            validationResult = failValidation('YouTube video is age restricted', 0.98);
        }
        else if (sourceType === 'youtube' && ingested.duration_seconds > 1200) {
            validationResult = failValidation('YouTube duration exceeds 20 minutes', 0.98);
        }
        else if (sourceType === 'web' && !ingested.raw_content) {
            validationResult = failValidation('Web content is not readable or empty', 0.9);
        }
        else if (request.subject === 'Dharm' && !includesAnyKeyword(normalizedBody, HINDU_KEYWORDS)) {
            validationResult = failValidation('Dharm subject must be Hindu-related only', 0.97);
        }
        else {
            validationResult = {
                is_valid: true,
                failure_reason: '',
                validated_duration_seconds: ingested.duration_seconds,
                validation_confidence: 0.92,
            };
        }
        if (!validationResult.is_valid) {
            results.push({
                source_type: ingested.source_type,
                url: ingested.url,
                title: ingested.title,
                status: 'rejected',
                rejection_reason: validationResult.failure_reason,
                confidence: {
                    ingestion: ingested.ingestion_confidence,
                    validation: validationResult.validation_confidence,
                },
            });
            continue;
        }
        seenUrls.add(ingested.url);
        const language = detectLanguage(normalizedBody);
        const subjectScores = scoreSubjects(normalizedBody);
        const [topSubject, topScore] = Object.entries(subjectScores).sort((a, b) => b[1] - a[1])[0];
        const difficultySignal = calculateDifficultySignal(normalizedBody, ingested.duration_seconds);
        const complexityScore = clampScore(difficultySignal / 1200);
        const classSuitability = bandFromDifficultySignal(difficultySignal);
        const complexityLevel = complexityFromScore(complexityScore);
        const planning = {
            include_summary: true,
            include_keywords: true,
            include_learning_objectives: true,
            subject: topSubject,
            class_suitability: classSuitability,
            complexity: complexityLevel,
            language: language.language,
        };
        const reviewStatus = request.human_review?.approved ? 'approved_for_publish' : 'pending_human_review';
        results.push({
            source_type: ingested.source_type,
            url: ingested.url,
            title: ingested.title,
            description: ingested.description,
            duration_seconds: ingested.duration_seconds,
            raw_content: ingested.raw_content,
            output: {
                language: language.language,
                subject: topSubject,
                class_suitability: classSuitability,
                complexity_level: complexityLevel,
                scoring_factors: {
                    language_complexity: clampScore(tokenizeCount(normalizedBody) / 600),
                    topic_difficulty: clampScore((topScore + complexityScore) / 2),
                    duration_factor: clampScore(Math.min(ingested.duration_seconds, 1200) / 1200),
                    keyword_factor: clampScore(topScore),
                },
                plan: planning,
                review_status: reviewStatus,
                reviewed_by: request.human_review?.reviewer || null,
                review_comment: request.human_review?.comment ||
                    (reviewStatus === 'approved_for_publish'
                        ? 'Approved by reviewer'
                        : 'Awaiting manual reviewer approval before DB insert/publish'),
            },
            confidence: {
                ingestion: ingested.ingestion_confidence,
                validation: validationResult.validation_confidence,
                language: language.confidence,
                subject: clampScore(topScore),
                class_suitability: clampScore(0.65 + complexityScore * 0.25),
                complexity: clampScore(0.7 + complexityScore * 0.2),
                planning: clampScore((clampScore(topScore) + clampScore(0.65 + complexityScore * 0.25) + clampScore(0.7 + complexityScore * 0.2)) / 3),
            },
        });
    }
    return {
        subject: request.subject,
        generated_at: new Date().toISOString(),
        count: results.length,
        results,
    };
}
