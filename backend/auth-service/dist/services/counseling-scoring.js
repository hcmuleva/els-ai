// Deterministic counseling scoring engine.
//
// Pure functions only — no DB access. Given the flat answer map collected by
// the counseling wizard (keyed by dotted question_key) plus the basic-info
// snapshot, it produces the holistic report card consumed by the API, the
// on-screen results view, and the PDF export.
//
// All survey inputs are on a 0–5 scale; everything is normalised to 0–100 for
// scoring so the bands and weights stay easy to reason about.
const SUBJECTS = [
    { key: 'math', label: 'Mathematics' },
    { key: 'science', label: 'Science' },
    { key: 'english', label: 'English' },
    { key: 'socialStudies', label: 'Social Studies' },
];
const SUBJECT_DIMENSIONS = ['concept', 'problemSolving', 'performance', 'interest'];
const COGNITIVE = ['logicalThinking', 'analyticalAbility', 'memoryRetention', 'attentionSpan'];
const BEHAVIORAL = ['discipline', 'consistency', 'responsibility', 'selfMotivation'];
const LEARNING = ['independentLearning', 'needsGuidance', 'handlesDifficulty'];
const EMOTIONAL = ['confidence', 'communication', 'collaboration', 'stressManagement'];
const INTERESTS = ['coding', 'arts', 'sports', 'readingWriting', 'scienceCuriosity'];
const LABELS = {
    logicalThinking: 'Logical thinking',
    analyticalAbility: 'Analytical ability',
    memoryRetention: 'Memory retention',
    attentionSpan: 'Attention span',
    discipline: 'Discipline',
    consistency: 'Consistency',
    responsibility: 'Responsibility',
    selfMotivation: 'Self motivation',
    independentLearning: 'Independent learning',
    needsGuidance: 'Needs guidance',
    handlesDifficulty: 'Handles difficulty',
    confidence: 'Confidence',
    communication: 'Communication',
    collaboration: 'Collaboration',
    stressManagement: 'Stress management',
};
function num(answers, key) {
    const raw = answers[key];
    if (raw === null || raw === undefined || raw === '')
        return null;
    const n = Number(raw);
    if (Number.isNaN(n))
        return null;
    return Math.max(0, Math.min(5, n));
}
function avg(values) {
    const present = values.filter((v) => v !== null);
    if (present.length === 0)
        return 0;
    return present.reduce((a, b) => a + b, 0) / present.length;
}
// 0–5 mean → 0–100
function to100(value) {
    return Math.round((value / 5) * 100);
}
function bandFor(score100) {
    if (score100 >= 70)
        return 'Strong';
    if (score100 >= 45)
        return 'Moderate';
    return 'Weak';
}
function ratingLabel(score100) {
    if (score100 >= 70)
        return 'High';
    if (score100 >= 45)
        return 'Moderate';
    return 'Low';
}
function str(answers, key) {
    const raw = answers[key];
    return typeof raw === 'string' ? raw.trim() : '';
}
export function buildCounselingReport(answers, snapshot) {
    // ── Academic ──────────────────────────────────────────────────────────
    const subjectPerformance = SUBJECTS.map(({ key, label }) => {
        const concept = num(answers, `${key}.concept`);
        const problemSolving = num(answers, `${key}.problemSolving`);
        const performance = num(answers, `${key}.performance`);
        const interest = num(answers, `${key}.interest`);
        const weighted = 0.35 * (concept ?? 0) +
            0.3 * (problemSolving ?? 0) +
            0.2 * (performance ?? 0) +
            0.15 * (interest ?? 0);
        const answered = [concept, problemSolving, performance, interest].filter((v) => v !== null).length;
        const confidenceScore = Number((answered / SUBJECT_DIMENSIONS.length).toFixed(2));
        const score = to100(weighted);
        return {
            subject: label,
            key,
            score,
            band: bandFor(score),
            confidenceScore,
            concept,
            problemSolving,
            interest,
        };
    });
    const academicAvg = avg(subjectPerformance.map((s) => s.score / 20)); // back to 0–5 mean
    const academic100 = to100(academicAvg);
    // ── Non-academic groups ────────────────────────────────────────────────
    const cognitive100 = to100(avg(COGNITIVE.map((k) => num(answers, `cognitive.${k}`))));
    const behavioral100 = to100(avg(BEHAVIORAL.map((k) => num(answers, `behavioral.${k}`))));
    // "needsGuidance" is inverted: high need = lower learning autonomy.
    const independentLearning = num(answers, 'learning.independentLearning');
    const needsGuidance = num(answers, 'learning.needsGuidance');
    const handlesDifficulty = num(answers, 'learning.handlesDifficulty');
    const learning100 = to100(avg([independentLearning, needsGuidance === null ? null : 5 - needsGuidance, handlesDifficulty]));
    const emotional100 = to100(avg(EMOTIONAL.map((k) => num(answers, `emotional.${k}`))));
    const nonAcademic100 = Math.round((cognitive100 + behavioral100 + learning100 + emotional100) / 4);
    // ── Interests ───────────────────────────────────────────────────────────
    const interest100 = to100(avg(INTERESTS.map((k) => num(answers, `interests.${k}`))));
    // ── Overall (academic 50% / non-academic 30% / interests 20%) ───────────
    const overallScore = Math.round(academic100 * 0.5 + nonAcademic100 * 0.3 + interest100 * 0.2);
    const level = overallScore < 45 ? 'Beginner' : overallScore < 75 ? 'Intermediate' : 'Advanced';
    // ── Study pattern ─────────────────────────────────────────────────────
    const consistency = num(answers, 'behavioral.consistency');
    let studyPatternType = 'Passive';
    if ((independentLearning ?? 0) >= 4 && (consistency ?? 0) >= 4)
        studyPatternType = 'Active';
    else if ((needsGuidance ?? 0) >= 4 || (independentLearning ?? 0) <= 2)
        studyPatternType = 'Guided';
    // ── Growth potential ────────────────────────────────────────────────────
    const discipline = num(answers, 'behavioral.discipline');
    const avgInterest5 = avg(subjectPerformance.map((s) => s.interest));
    const avgPerformance100 = academic100;
    let growthPotential = 'Medium';
    if (avgInterest5 >= 3.5 && avgPerformance100 < 55 && (discipline ?? 0) >= 2)
        growthPotential = 'High';
    else if (avgInterest5 < 2 && avgPerformance100 < 45)
        growthPotential = 'Emerging';
    // ── Skill analysis ──────────────────────────────────────────────────────
    const cognitiveStrengths = COGNITIVE.filter((k) => (num(answers, `cognitive.${k}`) ?? 0) >= 4).map((k) => LABELS[k]);
    const behavioralTraits = {};
    BEHAVIORAL.forEach((k) => {
        behavioralTraits[LABELS[k]] = ratingLabel(to100(num(answers, `behavioral.${k}`) ?? 0));
    });
    const socialEmotional = {};
    EMOTIONAL.forEach((k) => {
        socialEmotional[LABELS[k]] = ratingLabel(to100(num(answers, `emotional.${k}`) ?? 0));
    });
    // ── Insights + risks (rule engine) ──────────────────────────────────────
    const keyInsights = [];
    const riskIndicators = [];
    subjectPerformance.forEach((s) => {
        if ((s.problemSolving ?? 5) <= 2 && (s.concept ?? 5) <= 2) {
            keyInsights.push(`Needs foundational support in ${s.subject}`);
        }
        else if ((s.interest ?? 0) >= 4 && s.score <= 45) {
            keyInsights.push(`High curiosity in ${s.subject} but performance needs structured coaching`);
        }
        else if (s.band === 'Strong') {
            keyInsights.push(`Strong grasp of ${s.subject}`);
        }
    });
    if ((discipline ?? 5) <= 2 && (consistency ?? 5) <= 2) {
        riskIndicators.push({ name: 'Low habit stability (discipline + consistency)', severity: 'High' });
        keyInsights.push('Needs support building a steady study routine');
    }
    const selfMotivation = num(answers, 'behavioral.selfMotivation');
    if ((selfMotivation ?? 5) <= 2)
        riskIndicators.push({ name: 'Low self-motivation', severity: 'Medium' });
    const stressManagement = num(answers, 'emotional.stressManagement');
    if ((stressManagement ?? 5) <= 2)
        riskIndicators.push({ name: 'Low stress management', severity: 'Medium' });
    const attentionSpan = num(answers, 'cognitive.attentionSpan');
    if ((attentionSpan ?? 5) <= 2)
        riskIndicators.push({ name: 'Short attention span', severity: 'Low' });
    if (keyInsights.length === 0)
        keyInsights.push('Balanced profile with steady all-round development');
    // ── Recommendations ─────────────────────────────────────────────────────
    const subjectLevelRecs = [];
    subjectPerformance.forEach((s) => {
        if (s.band === 'Weak')
            subjectLevelRecs.push(`Revise ${s.subject} fundamentals with short daily practice`);
        else if (s.band === 'Moderate')
            subjectLevelRecs.push(`Strengthen conceptual clarity in ${s.subject}`);
    });
    if (subjectLevelRecs.length === 0)
        subjectLevelRecs.push('Maintain momentum with enrichment challenges across subjects');
    const skillLevelRecs = [];
    if ((discipline ?? 5) <= 3 || (consistency ?? 5) <= 3)
        skillLevelRecs.push('Build a fixed study routine with a parent checklist');
    if ((independentLearning ?? 5) <= 3)
        skillLevelRecs.push('Increase self-learning through guided worksheets');
    if ((stressManagement ?? 5) <= 3)
        skillLevelRecs.push('Introduce simple exam-coping and breathing strategies');
    if (skillLevelRecs.length === 0)
        skillLevelRecs.push('Encourage peer teaching to deepen mastery');
    const courseLevel = level;
    const courseSuggestions = [];
    const weakest = [...subjectPerformance].sort((a, b) => a.score - b.score)[0];
    if (weakest)
        courseSuggestions.push({ track: `${weakest.subject} Foundation Booster`, level: 'Beginner' });
    const topInterest = INTERESTS.map((k) => ({ k, v: num(answers, `interests.${k}`) ?? 0 })).sort((a, b) => b.v - a.v)[0];
    if (topInterest && topInterest.v >= 3) {
        const interestTrack = {
            coding: 'Coding & Logic Lab',
            arts: 'Creative Arts Studio',
            sports: 'Sports & Teamwork Program',
            readingWriting: 'Reading & Writing Club',
            scienceCuriosity: 'Science Curiosity Lab',
        };
        courseSuggestions.push({ track: interestTrack[topInterest.k], level: courseLevel });
    }
    const aiInterventionSuggestion = riskIndicators.some((r) => r.severity === 'High')
        ? 'Weekly adaptive practice + biweekly counselor check-in until routine stabilises'
        : 'Fortnightly adaptive quiz with progress review';
    return {
        summary: { overallScore, level, growthPotential, studyPatternType },
        studentProfile: {
            name: snapshot.name,
            classLevel: snapshot.classLevel,
            age: snapshot.age,
            board: snapshot.board,
        },
        subjectPerformance: subjectPerformance.map((s) => ({
            subject: s.subject,
            score: s.score,
            band: s.band,
            confidenceScore: s.confidenceScore,
        })),
        skillAnalysis: { cognitiveStrengths, behavioralTraits, socialEmotional },
        keyInsights,
        riskIndicators,
        recommendations: {
            subjectLevel: subjectLevelRecs,
            skillLevel: skillLevelRecs,
            courseSuggestions,
            aiInterventionSuggestion,
        },
        graphs: {
            radarSkills: {
                cognitive: cognitive100,
                behavioral: behavioral100,
                learning: learning100,
                emotional: emotional100,
            },
            subjectBars: subjectPerformance.map((s) => ({ subject: s.subject, score: s.score })),
        },
    };
}
// Open-ended text answers carried straight through to the report payload.
export function extractOpenResponses(answers) {
    return {
        weakness: str(answers, 'open.weakness'),
        improvementAreas: str(answers, 'open.improvementAreas'),
        motivationTrigger: str(answers, 'open.motivationTrigger'),
        parentComments: str(answers, 'open.parentComments'),
    };
}
