export type CounselingAnswers = Record<string, unknown>;
export type StudentSnapshot = {
    name?: string;
    classLevel?: string;
    age?: number | string;
    board?: string;
};
type Band = 'Strong' | 'Moderate' | 'Weak';
type Level = 'Beginner' | 'Intermediate' | 'Advanced';
type GrowthPotential = 'High' | 'Medium' | 'Emerging';
type StudyPattern = 'Active' | 'Guided' | 'Passive';
type Severity = 'High' | 'Medium' | 'Low';
export type CounselingReport = {
    summary: {
        overallScore: number;
        level: Level;
        growthPotential: GrowthPotential;
        studyPatternType: StudyPattern;
    };
    studentProfile: StudentSnapshot;
    subjectPerformance: Array<{
        subject: string;
        score: number;
        band: Band;
        confidenceScore: number;
    }>;
    skillAnalysis: {
        cognitiveStrengths: string[];
        behavioralTraits: Record<string, string>;
        socialEmotional: Record<string, string>;
    };
    keyInsights: string[];
    riskIndicators: Array<{
        name: string;
        severity: Severity;
    }>;
    recommendations: {
        subjectLevel: string[];
        skillLevel: string[];
        courseSuggestions: Array<{
            track: string;
            level: Level;
        }>;
        aiInterventionSuggestion: string;
    };
    graphs: {
        radarSkills: {
            cognitive: number;
            behavioral: number;
            learning: number;
            emotional: number;
        };
        subjectBars: Array<{
            subject: string;
            score: number;
        }>;
    };
};
export declare function buildCounselingReport(answers: CounselingAnswers, snapshot: StudentSnapshot): CounselingReport;
export declare function extractOpenResponses(answers: CounselingAnswers): {
    weakness: string;
    improvementAreas: string;
    motivationTrigger: string;
    parentComments: string;
};
export {};
//# sourceMappingURL=counseling-scoring.d.ts.map